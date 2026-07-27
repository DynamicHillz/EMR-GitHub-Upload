/**
 * Get Consumable Inventory Use Case Tests
 */

import { GetConsumableInventoryUseCase } from './get-consumable-inventory.use-case';

describe('GetConsumableInventoryUseCase', () => {
  let useCase: GetConsumableInventoryUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  beforeEach(() => {
    mockPrisma = {
      consumable: { findMany: jest.fn() },
    };

    useCase = new GetConsumableInventoryUseCase(mockPrisma);
  });

  it('should query non-deleted consumables with ACTIVE, non-deleted batches scoped to the tenant', async () => {
    mockPrisma.consumable.findMany.mockResolvedValue([]);

    await useCase.execute(tenantId);

    expect(mockPrisma.consumable.findMany).toHaveBeenCalledWith({
      where: { tenantId, isDeleted: false },
      include: {
        batches: { where: { status: 'ACTIVE', isDeleted: false }, orderBy: { expiryDate: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  });

  it('should flag lowStock when stockLevel is at or below reorderPoint', async () => {
    mockPrisma.consumable.findMany.mockResolvedValue([
      { id: 'cons-1', name: 'Gloves', stockLevel: 5, reorderPoint: 20, batches: [] },
    ]);

    const result = await useCase.execute(tenantId);

    expect(result[0].lowStock).toBe(true);
    expect(result[0].nearExpiry).toBe(false);
  });

  it('should handle batches with a null expiryDate (daysUntilExpiry null, not near-expiry)', async () => {
    mockPrisma.consumable.findMany.mockResolvedValue([
      {
        id: 'cons-1',
        name: 'Gauze',
        stockLevel: 100,
        reorderPoint: 20,
        batches: [{ id: 'b1', batchNumber: 'B-1', expiryDate: null, quantity: 10, status: 'ACTIVE' }],
      },
    ]);

    const result = await useCase.execute(tenantId);

    expect(result[0].batches[0].daysUntilExpiry).toBeNull();
    expect(result[0].batches[0].expiryDate).toBeNull();
    expect(result[0].nearExpiry).toBe(false);
  });

  it('should flag nearExpiry when a batch expires within the next 30 days', async () => {
    const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    mockPrisma.consumable.findMany.mockResolvedValue([
      {
        id: 'cons-1',
        name: 'Oxygen Mask',
        stockLevel: 100,
        reorderPoint: 20,
        batches: [{ id: 'b1', batchNumber: 'B-1', expiryDate: soon, quantity: 10, status: 'ACTIVE' }],
      },
    ]);

    const result = await useCase.execute(tenantId);

    expect(result[0].nearExpiry).toBe(true);
  });

  it('should return an empty array when there are no consumables', async () => {
    mockPrisma.consumable.findMany.mockResolvedValue([]);

    const result = await useCase.execute(tenantId);

    expect(result).toEqual([]);
  });
});
