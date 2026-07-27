/**
 * Add Consumable Batch Use Case Tests
 */

import { AddConsumableBatchUseCase } from './add-consumable-batch.use-case';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError';

describe('AddConsumableBatchUseCase', () => {
  let useCase: AddConsumableBatchUseCase;
  let mockPrisma: any;
  let mockTx: any;

  const tenantId = 'tenant-1';

  const validDto = {
    consumableId: 'cons-1',
    batchNumber: 'CBATCH-001',
    expiryDate: new Date('2099-01-01'),
    quantity: 200,
    unitCost: 5,
    sellingPrice: 8,
    supplier: 'Med Supplies Ltd',
  };

  const consumable = { id: 'cons-1', tenantId, name: 'Syringe 5ml' };

  beforeEach(() => {
    mockTx = {
      consumableBatch: { create: jest.fn() },
      consumable: { update: jest.fn() },
    };

    mockPrisma = {
      consumable: { findFirst: jest.fn() },
      consumableBatch: { findFirst: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    useCase = new AddConsumableBatchUseCase(mockPrisma);
  });

  it('should create a batch and increment the consumable stock level', async () => {
    mockPrisma.consumable.findFirst.mockResolvedValue(consumable);
    mockPrisma.consumableBatch.findFirst.mockResolvedValue(null);
    mockTx.consumableBatch.create.mockResolvedValue({
      id: 'cbatch-1',
      batchNumber: validDto.batchNumber,
      expiryDate: validDto.expiryDate,
      quantity: validDto.quantity,
    });

    const result = await useCase.execute(validDto, tenantId);

    expect(mockPrisma.consumable.findFirst).toHaveBeenCalledWith({
      where: { id: validDto.consumableId, tenantId },
    });
    expect(mockPrisma.consumableBatch.findFirst).toHaveBeenCalledWith({
      where: { tenantId, consumableId: validDto.consumableId, batchNumber: validDto.batchNumber },
    });
    expect(mockTx.consumableBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId,
        consumableId: validDto.consumableId,
        batchNumber: validDto.batchNumber,
        quantity: validDto.quantity,
        unitCost: validDto.unitCost,
        sellingPrice: validDto.sellingPrice,
        status: 'ACTIVE',
      }),
    });
    expect(mockTx.consumable.update).toHaveBeenCalledWith({
      where: { id: validDto.consumableId },
      data: { stockLevel: { increment: validDto.quantity } },
    });
    expect(result).toEqual({
      id: 'cbatch-1',
      batchNumber: validDto.batchNumber,
      expiryDate: validDto.expiryDate.toISOString(),
      quantity: validDto.quantity,
      consumableName: consumable.name,
    });
  });

  it('should allow a null expiryDate and return null expiryDate in the response', async () => {
    mockPrisma.consumable.findFirst.mockResolvedValue(consumable);
    mockPrisma.consumableBatch.findFirst.mockResolvedValue(null);
    mockTx.consumableBatch.create.mockResolvedValue({
      id: 'cbatch-2',
      batchNumber: 'CBATCH-002',
      expiryDate: null,
      quantity: 50,
    });

    const result = await useCase.execute(
      { ...validDto, batchNumber: 'CBATCH-002', expiryDate: undefined },
      tenantId
    );

    expect(result.expiryDate).toBeNull();
  });

  it('should reject a negative quantity, unitCost, or sellingPrice', async () => {
    await expect(
      useCase.execute({ ...validDto, quantity: -1 }, tenantId)
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute({ ...validDto, unitCost: -1 }, tenantId)
    ).rejects.toThrow('Quantity, unit cost, and selling price must not be negative');
    await expect(
      useCase.execute({ ...validDto, sellingPrice: -1 }, tenantId)
    ).rejects.toThrow(ValidationError);
    expect(mockPrisma.consumable.findFirst).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when the consumable does not exist for the tenant', async () => {
    mockPrisma.consumable.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(validDto, tenantId)).rejects.toThrow(NotFoundError);
    expect(mockPrisma.consumableBatch.findFirst).not.toHaveBeenCalled();
  });

  it('should throw ConflictError when the batch number already exists for the consumable', async () => {
    mockPrisma.consumable.findFirst.mockResolvedValue(consumable);
    mockPrisma.consumableBatch.findFirst.mockResolvedValue({ id: 'existing-batch' });

    await expect(useCase.execute(validDto, tenantId)).rejects.toThrow(ConflictError);
    await expect(useCase.execute(validDto, tenantId)).rejects.toThrow(
      `Batch number ${validDto.batchNumber} already exists for this consumable`
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
