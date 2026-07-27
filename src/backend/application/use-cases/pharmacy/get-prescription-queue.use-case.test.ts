/**
 * Get Prescription Queue Use Case Tests
 */

import { GetPrescriptionQueueUseCase } from './get-prescription-queue.use-case';

describe('GetPrescriptionQueueUseCase', () => {
  let useCase: GetPrescriptionQueueUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  function makePrescription(overrides: Partial<any> = {}) {
    return {
      id: 'rx-1',
      patientId: 'patient-1',
      patient: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'MALE',
        allergies: ['Penicillin'],
      },
      doctor: { firstName: 'Jane', lastName: 'Smith' },
      medication: { unitPrice: 50 },
      consultation: { subjective: 'Patient complains of fever and cough' },
      doctorId: 'doctor-1',
      medicationName: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'Twice daily',
      duration: '7 days',
      instructions: 'Take with food',
      quantity: 14,
      createdAt: new Date('2026-01-01'),
      allergyWarning: false,
      interactionWarning: false,
      status: 'PENDING',
      ...overrides,
    };
  }

  beforeEach(() => {
    mockPrisma = {
      prescription: { findMany: jest.fn() },
    };

    useCase = new GetPrescriptionQueueUseCase(mockPrisma);
  });

  it('should default to PENDING status when no status/patientId filter is given', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([]);

    await useCase.execute({}, tenantId);

    expect(mockPrisma.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, status: 'PENDING' },
        take: 50,
        skip: 0,
      })
    );
  });

  it('should not force a status filter when a patientId filter is present', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([]);

    await useCase.execute({ patientId: 'patient-1' }, tenantId);

    expect(mockPrisma.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, patientId: 'patient-1' },
      })
    );
  });

  it('should apply an explicit status filter', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([]);

    await useCase.execute({ status: 'DISPENSED' }, tenantId);

    expect(mockPrisma.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId, status: 'DISPENSED' } })
    );
  });

  it('should build an OR search clause across medication name and patient fields', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([]);

    await useCase.execute({ search: 'amox' }, tenantId);

    const whereArg = mockPrisma.prescription.findMany.mock.calls[0][0].where;
    expect(whereArg.OR).toEqual([
      { medicationName: { contains: 'amox' } },
      {
        patient: {
          OR: [
            { firstName: { contains: 'amox' } },
            { lastName: { contains: 'amox' } },
            { patientId: { contains: 'amox' } },
          ],
        },
      },
    ]);
  });

  it('should apply billingStatus filter when provided', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([]);

    await useCase.execute({ billingStatus: 'UNBILLED' }, tenantId);

    expect(mockPrisma.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ billingStatus: 'UNBILLED' }),
      })
    );
  });

  it('should respect custom limit/offset for pagination', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([]);

    await useCase.execute({ limit: 10, offset: 20 }, tenantId);

    expect(mockPrisma.prescription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 })
    );
  });

  it('should compute patient age and truncate a long clinical indication to 80 chars with an ellipsis', async () => {
    const longSubjective = 'a'.repeat(100);
    mockPrisma.prescription.findMany.mockResolvedValue([
      makePrescription({ consultation: { subjective: longSubjective } }),
    ]);

    const result = await useCase.execute({}, tenantId);

    expect(result[0].patientAge).toBeGreaterThanOrEqual(35);
    expect(result[0].clinicalIndication).toBe('a'.repeat(80) + '...');
  });

  it('should leave clinicalIndication undefined when there is no consultation', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([makePrescription({ consultation: null })]);

    const result = await useCase.execute({}, tenantId);

    expect(result[0].clinicalIndication).toBeUndefined();
  });

  it('should default unitPrice to 0 when the prescription has no linked medication', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([makePrescription({ medication: null })]);

    const result = await useCase.execute({}, tenantId);

    expect(result[0].unitPrice).toBe(0);
  });

  it('should shape the full DTO for a matching prescription', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([makePrescription()]);

    const result = await useCase.execute({}, tenantId);

    expect(result[0]).toMatchObject({
      id: 'rx-1',
      patientId: 'patient-1',
      patientName: 'John Doe',
      patientGender: 'MALE',
      allergies: ['Penicillin'],
      medicationName: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'Twice daily',
      duration: '7 days',
      instructions: 'Take with food',
      quantity: 14,
      prescribedBy: 'doctor-1',
      prescribedByName: 'Jane Smith',
      allergyWarning: false,
      interactionWarning: false,
      status: 'PENDING',
      unitPrice: 50,
    });
  });

  it('should return an empty array when there are no matching prescriptions', async () => {
    mockPrisma.prescription.findMany.mockResolvedValue([]);

    const result = await useCase.execute({}, tenantId);

    expect(result).toEqual([]);
  });
});
