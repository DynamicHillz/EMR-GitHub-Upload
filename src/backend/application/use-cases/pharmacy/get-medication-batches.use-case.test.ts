/**
 * Get Medication Batches Use Case Tests
 */

import { GetMedicationBatchesUseCase } from './get-medication-batches.use-case';

describe('GetMedicationBatchesUseCase', () => {
  let useCase: GetMedicationBatchesUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const dto = { medicationName: 'Amoxicillin' };

  beforeEach(() => {
    mockPrisma = {
      medication: { findFirst: jest.fn() },
      medicationBatch: { findMany: jest.fn() },
    };

    useCase = new GetMedicationBatchesUseCase(mockPrisma);
  });

  it('should return an empty array when no medication matches the given name for the tenant', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(null);

    const result = await useCase.execute(dto, tenantId);

    expect(result).toEqual([]);
    expect(mockPrisma.medicationBatch.findMany).not.toHaveBeenCalled();
  });

  it('should fetch ACTIVE batches with stock, ordered FEFO (earliest expiry first)', async () => {
    const medication = { id: 'med-1', tenantId, name: 'Amoxicillin' };
    mockPrisma.medication.findFirst.mockResolvedValue(medication);
    const expiry = new Date('2099-01-01');
    mockPrisma.medicationBatch.findMany.mockResolvedValue([
      { id: 'batch-1', batchNumber: 'B-001', expiryDate: expiry, quantity: 30 },
    ]);

    const result = await useCase.execute(dto, tenantId);

    expect(mockPrisma.medicationBatch.findMany).toHaveBeenCalledWith({
      where: { tenantId, medicationId: medication.id, status: 'ACTIVE', quantity: { gt: 0 } },
      orderBy: [{ expiryDate: 'asc' }],
    });
    expect(result).toEqual([
      {
        id: 'batch-1',
        batchNumber: 'B-001',
        expiryDate: expiry.toISOString(),
        quantity: 30,
        medicationName: 'Amoxicillin',
      },
    ]);
  });

  it('should return an empty array when the medication has no batches in stock', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue({ id: 'med-1', tenantId, name: 'Amoxicillin' });
    mockPrisma.medicationBatch.findMany.mockResolvedValue([]);

    const result = await useCase.execute(dto, tenantId);

    expect(result).toEqual([]);
  });
});
