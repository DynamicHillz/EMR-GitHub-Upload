/**
 * Get Consumables Use Case Tests
 */

import { GetConsumablesUseCase } from './get-consumables.use-case';

describe('GetConsumablesUseCase', () => {
  let useCase: GetConsumablesUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  beforeEach(() => {
    mockPrisma = {
      consumable: { findMany: jest.fn() },
    };

    useCase = new GetConsumablesUseCase(mockPrisma);
  });

  it('should query non-deleted consumables scoped to the tenant, ordered by name', async () => {
    mockPrisma.consumable.findMany.mockResolvedValue([]);

    await useCase.execute(tenantId);

    expect(mockPrisma.consumable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, isDeleted: false },
        orderBy: { name: 'asc' },
      })
    );
  });

  it('should map unitPrice to a number and null fields to undefined', async () => {
    mockPrisma.consumable.findMany.mockResolvedValue([
      {
        id: 'cons-1',
        name: 'Syringe',
        category: null,
        unit: 'piece',
        description: null,
        unitPrice: 20,
        reorderPoint: 50,
        stockLevel: 500,
      },
    ]);

    const result = await useCase.execute(tenantId);

    expect(result).toEqual([
      {
        id: 'cons-1',
        name: 'Syringe',
        category: undefined,
        unit: 'piece',
        description: undefined,
        unitPrice: 20,
        reorderPoint: 50,
        stockLevel: 500,
      },
    ]);
  });

  it('should return an empty array when there are no consumables', async () => {
    mockPrisma.consumable.findMany.mockResolvedValue([]);

    const result = await useCase.execute(tenantId);

    expect(result).toEqual([]);
  });
});
