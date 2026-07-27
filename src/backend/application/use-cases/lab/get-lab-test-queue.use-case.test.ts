/**
 * Get Lab Test Queue Use Case Tests
 *
 * The use case builds an (unused) `where` variable and then constructs the
 * actual Prisma `where` clause inline for the real findMany call — these
 * tests assert against the clause that is actually sent to Prisma, not the
 * dead intermediate variable.
 */

import { GetLabTestQueueUseCase } from './get-lab-test-queue.use-case';

describe('GetLabTestQueueUseCase', () => {
  let useCase: GetLabTestQueueUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const dob = new Date('2000-01-01');

  const record = {
    id: 'record-1',
    orderId: 'order-1',
    status: 'PENDING',
    accessionNumber: 'ACC-1',
    unitPrice: 500,
    specimenType: null,
    specimenQuality: null,
    collectedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-07-01T09:00:00.000Z'),
    order: {
      patientId: 'patient-1',
      orderedById: 'doctor-1',
      consultationId: null,
      clinicalNotes: 'check',
      urgency: 'ROUTINE',
      patient: { firstName: 'Jane', lastName: 'Doe', dateOfBirth: dob, gender: 'FEMALE' },
      orderedBy: { firstName: 'John', lastName: 'Smith' },
    },
    test: { name: 'CBC', loincCode: null },
  };

  beforeEach(() => {
    mockPrisma = {
      labTestRecord: {
        findMany: jest.fn().mockResolvedValue([record]),
      },
    };

    useCase = new GetLabTestQueueUseCase(mockPrisma);
  });

  const orderByShape = [{ order: { urgency: 'desc' } }, { createdAt: 'asc' }];

  it('should default to PENDING/IN_PROGRESS status when no filters are given', async () => {
    await useCase.execute(tenantId);

    expect(mockPrisma.labTestRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          order: {},
        },
        orderBy: orderByShape,
        take: undefined,
      })
    );
  });

  it('should filter by an explicit status', async () => {
    await useCase.execute(tenantId, { status: 'COMPLETED' as any });

    expect(mockPrisma.labTestRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, status: 'COMPLETED', order: {} },
      })
    );
  });

  it('should still apply the default PENDING/IN_PROGRESS status when status is "ALL" and no patientId is given', async () => {
    await useCase.execute(tenantId, { status: 'ALL' as any });

    expect(mockPrisma.labTestRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] }, order: {} },
      })
    );
  });

  it('should omit the status filter entirely when a patientId is given without an explicit status', async () => {
    await useCase.execute(tenantId, { patientId: 'patient-1' });

    expect(mockPrisma.labTestRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, order: { patientId: 'patient-1' } },
      })
    );
  });

  it('should nest the urgency filter under order', async () => {
    await useCase.execute(tenantId, { urgency: 'STAT' as any });

    expect(mockPrisma.labTestRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] }, order: { urgency: 'STAT' } },
      })
    );
  });

  it('should nest the billingStatus filter under order', async () => {
    await useCase.execute(tenantId, { billingStatus: 'BILLED' });

    expect(mockPrisma.labTestRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          order: { billingStatus: 'BILLED' },
        },
      })
    );
  });

  it('should pass the limit through as `take`', async () => {
    await useCase.execute(tenantId, { limit: 10 });

    expect(mockPrisma.labTestRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });

  it('should map records into the queue DTO shape, computing age and falling back testCode to the test name', async () => {
    const result = await useCase.execute(tenantId);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'record-1',
        orderId: 'order-1',
        patientId: 'patient-1',
        patientName: 'Jane Doe',
        testName: 'CBC',
        testCode: 'CBC',
        orderedByName: 'John Smith',
        urgency: 'ROUTINE',
        status: 'PENDING',
      }),
    ]);
    expect(typeof result[0].patientAge).toBe('number');
  });
});
