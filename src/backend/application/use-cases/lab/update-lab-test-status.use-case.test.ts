/**
 * Update Lab Test Status Use Case Tests
 *
 * REVIEWED is deliberately unreachable from this use case (only
 * review-lab-results.use-case.ts may set it) — several tests here lock that
 * invariant down.
 */

import { UpdateLabTestStatusUseCase } from './update-lab-test-status.use-case';

describe('UpdateLabTestStatusUseCase', () => {
  let useCase: UpdateLabTestStatusUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const labTestId = 'record-1';

  beforeEach(() => {
    mockPrisma = {
      labTestRecord: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    useCase = new UpdateLabTestStatusUseCase(mockPrisma);
  });

  function withStatus(status: string) {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue({ id: labTestId, status });
  }

  it('should throw when the lab test does not exist in this tenant', async () => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(labTestId, { status: 'IN_PROGRESS' as any }, tenantId)).rejects.toThrow(
      'Lab test not found'
    );
    expect(mockPrisma.labTestRecord.update).not.toHaveBeenCalled();
  });

  it('should reject any transition once the test is REVIEWED', async () => {
    withStatus('REVIEWED');

    await expect(useCase.execute(labTestId, { status: 'COMPLETED' as any }, tenantId)).rejects.toThrow(
      'Cannot change status of reviewed lab test'
    );
  });

  it('should reject any transition once the test is REJECTED', async () => {
    withStatus('REJECTED');

    await expect(useCase.execute(labTestId, { status: 'IN_PROGRESS' as any }, tenantId)).rejects.toThrow(
      'Cannot change status of rejected lab test'
    );
  });

  it('should allow PENDING -> IN_PROGRESS', async () => {
    withStatus('PENDING');

    await useCase.execute(labTestId, { status: 'IN_PROGRESS' as any }, tenantId);

    expect(mockPrisma.labTestRecord.update).toHaveBeenCalledWith({
      where: { id: labTestId },
      data: { status: 'IN_PROGRESS' },
    });
  });

  it('should allow PENDING -> REJECTED', async () => {
    withStatus('PENDING');

    await useCase.execute(labTestId, { status: 'REJECTED' as any }, tenantId);

    expect(mockPrisma.labTestRecord.update).toHaveBeenCalledWith({
      where: { id: labTestId },
      data: { status: 'REJECTED' },
    });
  });

  it('should allow IN_PROGRESS -> COMPLETED', async () => {
    withStatus('IN_PROGRESS');

    await useCase.execute(labTestId, { status: 'COMPLETED' as any }, tenantId);

    expect(mockPrisma.labTestRecord.update).toHaveBeenCalledWith({
      where: { id: labTestId },
      data: { status: 'COMPLETED' },
    });
  });

  it('should allow IN_PROGRESS -> REJECTED', async () => {
    withStatus('IN_PROGRESS');

    await useCase.execute(labTestId, { status: 'REJECTED' as any }, tenantId);

    expect(mockPrisma.labTestRecord.update).toHaveBeenCalledWith({
      where: { id: labTestId },
      data: { status: 'REJECTED' },
    });
  });

  it('should reject PENDING -> COMPLETED as an invalid transition', async () => {
    withStatus('PENDING');

    await expect(useCase.execute(labTestId, { status: 'COMPLETED' as any }, tenantId)).rejects.toThrow(
      'Invalid status transition from PENDING to COMPLETED'
    );
    expect(mockPrisma.labTestRecord.update).not.toHaveBeenCalled();
  });

  it('should reject COMPLETED -> REVIEWED via this endpoint (must go through review-lab-results)', async () => {
    withStatus('COMPLETED');

    await expect(useCase.execute(labTestId, { status: 'REVIEWED' as any }, tenantId)).rejects.toThrow(
      'Invalid status transition from COMPLETED to REVIEWED'
    );
    expect(mockPrisma.labTestRecord.update).not.toHaveBeenCalled();
  });

  it('should reject any transition out of CANCELLED', async () => {
    withStatus('CANCELLED');

    await expect(useCase.execute(labTestId, { status: 'IN_PROGRESS' as any }, tenantId)).rejects.toThrow(
      'Invalid status transition from CANCELLED to IN_PROGRESS'
    );
  });
});
