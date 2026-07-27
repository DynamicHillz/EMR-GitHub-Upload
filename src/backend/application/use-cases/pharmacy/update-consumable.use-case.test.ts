/**
 * Update Consumable Use Case Tests
 */

import { UpdateConsumableUseCase } from './update-consumable.use-case';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

describe('UpdateConsumableUseCase', () => {
  let useCase: UpdateConsumableUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const id = 'cons-1';

  const existing = {
    id,
    tenantId,
    name: 'Syringe',
    category: 'Injection Supplies',
    unit: 'piece',
    description: 'Old description',
    reorderPoint: 10,
    unitPrice: 20,
    stockLevel: 100,
  };

  beforeEach(() => {
    mockPrisma = {
      consumable: { findFirst: jest.fn(), update: jest.fn() },
    };

    useCase = new UpdateConsumableUseCase(mockPrisma);
  });

  it('should update provided fields while falling back to existing values for omitted ones', async () => {
    mockPrisma.consumable.findFirst.mockResolvedValue(existing);
    mockPrisma.consumable.update.mockResolvedValue({ ...existing, name: 'Syringe 5ml' });

    const result = await useCase.execute(id, tenantId, { name: 'Syringe 5ml' });

    expect(mockPrisma.consumable.findFirst).toHaveBeenCalledWith({ where: { id, tenantId } });
    expect(mockPrisma.consumable.update).toHaveBeenCalledWith({
      where: { id },
      data: {
        name: 'Syringe 5ml',
        category: existing.category,
        unit: existing.unit,
        description: existing.description,
        reorderPoint: existing.reorderPoint,
        unitPrice: existing.unitPrice,
      },
    });
    expect(result.name).toBe('Syringe 5ml');
  });

  it('should clear category/description to null when explicitly set to an empty string', async () => {
    mockPrisma.consumable.findFirst.mockResolvedValue(existing);
    mockPrisma.consumable.update.mockResolvedValue({});

    await useCase.execute(id, tenantId, { category: '', description: '' });

    expect(mockPrisma.consumable.update).toHaveBeenCalledWith({
      where: { id },
      data: expect.objectContaining({ category: null, description: null }),
    });
  });

  it('should not attempt to set stockLevel from the dto', async () => {
    mockPrisma.consumable.findFirst.mockResolvedValue(existing);
    mockPrisma.consumable.update.mockResolvedValue({});

    await useCase.execute(id, tenantId, { stockLevel: 9999 });

    const dataArg = mockPrisma.consumable.update.mock.calls[0][0].data;
    expect(dataArg.stockLevel).toBeUndefined();
  });

  it('should throw NotFoundError when the consumable does not exist for the tenant', async () => {
    mockPrisma.consumable.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(id, tenantId, { name: 'X' })).rejects.toThrow(NotFoundError);
    expect(mockPrisma.consumable.update).not.toHaveBeenCalled();
  });

  it('should reject a negative unitPrice', async () => {
    mockPrisma.consumable.findFirst.mockResolvedValue(existing);

    await expect(useCase.execute(id, tenantId, { unitPrice: -1 })).rejects.toThrow(ValidationError);
    expect(mockPrisma.consumable.update).not.toHaveBeenCalled();
  });

  it('should reject a negative reorderPoint', async () => {
    mockPrisma.consumable.findFirst.mockResolvedValue(existing);

    await expect(useCase.execute(id, tenantId, { reorderPoint: -1 })).rejects.toThrow(
      'Unit price and reorder point must not be negative'
    );
  });
});
