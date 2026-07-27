/**
 * Get Inventory Use Case Tests
 */

import { GetInventoryUseCase } from './get-inventory.use-case';

describe('GetInventoryUseCase', () => {
  let useCase: GetInventoryUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  beforeEach(() => {
    mockPrisma = {
      medication: { findMany: jest.fn() },
    };

    useCase = new GetInventoryUseCase(mockPrisma);
  });

  it('should query medications with ACTIVE batches scoped to the tenant', async () => {
    mockPrisma.medication.findMany.mockResolvedValue([]);

    await useCase.execute(tenantId);

    expect(mockPrisma.medication.findMany).toHaveBeenCalledWith({
      where: { tenantId },
      include: {
        batches: { where: { status: 'ACTIVE' }, orderBy: { expiryDate: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  });

  it('should flag lowStock when stockLevel is at or below reorderPoint', async () => {
    mockPrisma.medication.findMany.mockResolvedValue([
      { id: 'med-1', name: 'Paracetamol', stockLevel: 5, reorderPoint: 20, batches: [] },
    ]);

    const result = await useCase.execute(tenantId);

    expect(result[0].lowStock).toBe(true);
    expect(result[0].nearExpiry).toBe(false);
  });

  it('should flag nearExpiry when a batch expires within the next 30 days', async () => {
    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    mockPrisma.medication.findMany.mockResolvedValue([
      {
        id: 'med-1',
        name: 'Paracetamol',
        stockLevel: 100,
        reorderPoint: 20,
        batches: [{ id: 'b1', batchNumber: 'B-1', expiryDate: soon, quantity: 10, status: 'ACTIVE' }],
      },
    ]);

    const result = await useCase.execute(tenantId);

    expect(result[0].nearExpiry).toBe(true);
    expect(result[0].batches[0]).toMatchObject({
      id: 'b1',
      batchNumber: 'B-1',
      quantity: 10,
      status: 'ACTIVE',
    });
    expect(result[0].batches[0].daysUntilExpiry).toBeGreaterThanOrEqual(9);
  });

  it('should return an empty array when there are no medications', async () => {
    mockPrisma.medication.findMany.mockResolvedValue([]);

    const result = await useCase.execute(tenantId);

    expect(result).toEqual([]);
  });
});
