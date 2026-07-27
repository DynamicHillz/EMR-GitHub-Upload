/**
 * Update Specimen Details Use Case Tests
 */

import { UpdateSpecimenDetailsUseCase } from './update-specimen-details.use-case';

describe('UpdateSpecimenDetailsUseCase', () => {
  let useCase: UpdateSpecimenDetailsUseCase;
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

    useCase = new UpdateSpecimenDetailsUseCase(mockPrisma);
  });

  function withStatus(status: string) {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue({ id: labTestId, status });
  }

  it('should throw when the lab test does not exist in this tenant', async () => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(labTestId, { specimenType: 'Blood' }, tenantId)).rejects.toThrow(
      'Lab test not found'
    );
    expect(mockPrisma.labTestRecord.update).not.toHaveBeenCalled();
  });

  it('should throw when the lab test has already been reviewed', async () => {
    withStatus('REVIEWED');

    await expect(useCase.execute(labTestId, { specimenType: 'Blood' }, tenantId)).rejects.toThrow(
      'Cannot update specimen details for reviewed lab test'
    );
    expect(mockPrisma.labTestRecord.update).not.toHaveBeenCalled();
  });

  it('should update specimenType alone', async () => {
    withStatus('PENDING');

    await useCase.execute(labTestId, { specimenType: 'Blood' }, tenantId);

    expect(mockPrisma.labTestRecord.update).toHaveBeenCalledWith({
      where: { id: labTestId },
      data: { specimenType: 'Blood' },
    });
  });

  it('should update a non-REJECTED specimenQuality without requiring a rejection reason', async () => {
    withStatus('PENDING');

    await useCase.execute(labTestId, { specimenQuality: 'GOOD' }, tenantId);

    expect(mockPrisma.labTestRecord.update).toHaveBeenCalledWith({
      where: { id: labTestId },
      data: { specimenQuality: 'GOOD' },
    });
  });

  it('should throw when marking specimenQuality REJECTED without a rejectionReason', async () => {
    withStatus('PENDING');

    await expect(
      useCase.execute(labTestId, { specimenQuality: 'REJECTED' }, tenantId)
    ).rejects.toThrow('Rejection reason is required when rejecting specimen');
    expect(mockPrisma.labTestRecord.update).not.toHaveBeenCalled();
  });

  it('should set status REJECTED and store the rejectionReason when specimenQuality is REJECTED with a reason', async () => {
    withStatus('PENDING');

    await useCase.execute(
      labTestId,
      { specimenQuality: 'REJECTED', rejectionReason: 'Hemolyzed sample' },
      tenantId
    );

    expect(mockPrisma.labTestRecord.update).toHaveBeenCalledWith({
      where: { id: labTestId },
      data: {
        specimenQuality: 'REJECTED',
        status: 'REJECTED',
        rejectionReason: 'Hemolyzed sample',
      },
    });
  });

  it('should update collectedAt when provided', async () => {
    withStatus('PENDING');
    const collectedAt = new Date('2026-07-27T10:00:00.000Z');

    await useCase.execute(labTestId, { collectedAt }, tenantId);

    expect(mockPrisma.labTestRecord.update).toHaveBeenCalledWith({
      where: { id: labTestId },
      data: { collectedAt },
    });
  });

  it('should update rejectionReason on its own even without a specimenQuality change', async () => {
    withStatus('PENDING');

    await useCase.execute(labTestId, { rejectionReason: 'Insufficient volume' }, tenantId);

    expect(mockPrisma.labTestRecord.update).toHaveBeenCalledWith({
      where: { id: labTestId },
      data: { rejectionReason: 'Insufficient volume' },
    });
  });

  it('should send an empty update when no recognized fields are provided', async () => {
    withStatus('PENDING');

    await useCase.execute(labTestId, {}, tenantId);

    expect(mockPrisma.labTestRecord.update).toHaveBeenCalledWith({
      where: { id: labTestId },
      data: {},
    });
  });
});
