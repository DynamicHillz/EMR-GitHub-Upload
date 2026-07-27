/**
 * Add Consumable Use Case Tests
 */

import { AddConsumableUseCase } from './add-consumable.use-case';
import { ConflictError, ValidationError } from '../../../shared/errors/AppError';

describe('AddConsumableUseCase', () => {
  let useCase: AddConsumableUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  const validDto = {
    name: 'Disposable Syringe 5ml',
    category: 'Injection Supplies',
    unit: 'piece',
    description: 'Single-use syringe',
    reorderPoint: 50,
    unitPrice: 20,
    stockLevel: 500,
  };

  beforeEach(() => {
    mockPrisma = {
      consumable: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    useCase = new AddConsumableUseCase(mockPrisma);
  });

  it('should create a consumable when the name is unique', async () => {
    mockPrisma.consumable.findFirst.mockResolvedValue(null);
    mockPrisma.consumable.create.mockResolvedValue({ id: 'cons-1', ...validDto });

    const result = await useCase.execute(validDto, tenantId);

    expect(mockPrisma.consumable.findFirst).toHaveBeenCalledWith({
      where: { tenantId, name: validDto.name },
    });
    expect(mockPrisma.consumable.create).toHaveBeenCalledWith({
      data: {
        tenantId,
        name: validDto.name,
        category: validDto.category,
        unit: validDto.unit,
        description: validDto.description,
        stockLevel: validDto.stockLevel,
        reorderPoint: validDto.reorderPoint,
        unitPrice: validDto.unitPrice,
      },
    });
    expect(result).toEqual({ id: 'cons-1', ...validDto });
  });

  it('should default unit to "piece", stockLevel to 0, and reorderPoint to 10 when omitted', async () => {
    mockPrisma.consumable.findFirst.mockResolvedValue(null);
    mockPrisma.consumable.create.mockResolvedValue({ id: 'cons-2' });

    await useCase.execute({ name: 'Gauze Roll', unitPrice: 5 }, tenantId);

    expect(mockPrisma.consumable.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        unit: 'piece',
        stockLevel: 0,
        reorderPoint: 10,
        category: undefined,
        description: undefined,
      }),
    });
  });

  it('should reject a negative unitPrice', async () => {
    await expect(
      useCase.execute({ ...validDto, unitPrice: -1 }, tenantId)
    ).rejects.toThrow(ValidationError);
    expect(mockPrisma.consumable.create).not.toHaveBeenCalled();
  });

  it('should reject a negative stockLevel', async () => {
    await expect(
      useCase.execute({ ...validDto, stockLevel: -1 }, tenantId)
    ).rejects.toThrow('Unit price, stock level, and reorder point must not be negative');
  });

  it('should reject a negative reorderPoint', async () => {
    await expect(
      useCase.execute({ ...validDto, reorderPoint: -1 }, tenantId)
    ).rejects.toThrow(ValidationError);
  });

  it('should reject when a consumable with the same name already exists for the tenant', async () => {
    mockPrisma.consumable.findFirst.mockResolvedValue({ id: 'existing-cons' });

    await expect(useCase.execute(validDto, tenantId)).rejects.toThrow(ConflictError);
    await expect(useCase.execute(validDto, tenantId)).rejects.toThrow(
      'Consumable with this name already exists'
    );
    expect(mockPrisma.consumable.create).not.toHaveBeenCalled();
  });
});
