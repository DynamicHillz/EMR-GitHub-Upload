/**
 * Review Lab Results Use Case Tests
 */

import { ReviewLabResultsUseCase } from './review-lab-results.use-case';

describe('ReviewLabResultsUseCase', () => {
  let useCase: ReviewLabResultsUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const labTestId = 'record-1';
  const doctorId = 'doctor-1';

  beforeEach(() => {
    mockPrisma = {
      labTestRecord: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    useCase = new ReviewLabResultsUseCase(mockPrisma);
  });

  it('should throw when the lab test does not exist in this tenant', async () => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(labTestId, { approved: true }, doctorId, tenantId)).rejects.toThrow(
      'Lab test not found'
    );
    expect(mockPrisma.labTestRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: labTestId, tenantId } })
    );
  });

  it('should throw when the lab test is not COMPLETED', async () => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue({ status: 'IN_PROGRESS', resultValues: [] });

    await expect(useCase.execute(labTestId, { approved: true }, doctorId, tenantId)).rejects.toThrow(
      'Can only review lab tests that are COMPLETED'
    );
    expect(mockPrisma.labTestRecord.update).not.toHaveBeenCalled();
  });

  it('should throw when there are no result values to review', async () => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue({ status: 'COMPLETED', resultValues: [] });

    await expect(useCase.execute(labTestId, { approved: true }, doctorId, tenantId)).rejects.toThrow(
      'Cannot review lab test without results'
    );
    expect(mockPrisma.labTestRecord.update).not.toHaveBeenCalled();
  });

  it('should mark the test REVIEWED and stamp reviewer details when approved', async () => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue({
      status: 'COMPLETED',
      resultValues: [{ id: 'rv-1' }],
    });

    await useCase.execute(labTestId, { approved: true, reviewNotes: 'looks good' }, doctorId, tenantId);

    expect(mockPrisma.labTestRecord.update).toHaveBeenCalledWith({
      where: { id: labTestId },
      data: {
        reviewedById: doctorId,
        reviewedAt: expect.any(Date),
        reviewNotes: 'looks good',
        status: 'REVIEWED',
      },
    });
  });

  it('should keep the test COMPLETED (not REVIEWED) when rejected/not approved', async () => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue({
      status: 'COMPLETED',
      resultValues: [{ id: 'rv-1' }],
    });

    await useCase.execute(labTestId, { approved: false }, doctorId, tenantId);

    expect(mockPrisma.labTestRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) })
    );
  });
});
