/**
 * Add Medication Batch Use Case Tests
 */

import { AddMedicationBatchUseCase } from './add-medication-batch.use-case';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError';

describe('AddMedicationBatchUseCase', () => {
  let useCase: AddMedicationBatchUseCase;
  let mockPrisma: any;
  let mockTx: any;

  const tenantId = 'tenant-1';

  const validDto = {
    medicationId: 'med-1',
    batchNumber: 'BATCH-001',
    expiryDate: new Date('2099-01-01'),
    quantity: 100,
    unitCost: 10,
    sellingPrice: 15,
    supplier: 'Acme Pharma',
  };

  const medication = { id: 'med-1', tenantId, name: 'Paracetamol' };

  beforeEach(() => {
    mockTx = {
      medicationBatch: { create: jest.fn() },
      medication: { update: jest.fn() },
    };

    mockPrisma = {
      medication: { findFirst: jest.fn(), update: jest.fn() },
      medicationBatch: { findFirst: jest.fn(), create: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    useCase = new AddMedicationBatchUseCase(mockPrisma);
  });

  it('should create a batch and increment the medication stock level', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(medication);
    mockPrisma.medicationBatch.findFirst.mockResolvedValue(null);
    const createdBatch = {
      id: 'batch-1',
      batchNumber: validDto.batchNumber,
      expiryDate: validDto.expiryDate,
      quantity: validDto.quantity,
    };
    mockTx.medicationBatch.create.mockResolvedValue(createdBatch);
    mockTx.medication.update.mockResolvedValue({});

    const result = await useCase.execute(validDto, tenantId);

    expect(mockPrisma.medication.findFirst).toHaveBeenCalledWith({
      where: { id: validDto.medicationId, tenantId },
    });
    expect(mockPrisma.medicationBatch.findFirst).toHaveBeenCalledWith({
      where: { tenantId, medicationId: validDto.medicationId, batchNumber: validDto.batchNumber },
    });
    expect(mockTx.medicationBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId,
        medicationId: validDto.medicationId,
        batchNumber: validDto.batchNumber,
        expiryDate: validDto.expiryDate,
        quantity: validDto.quantity,
        unitCost: validDto.unitCost,
        sellingPrice: validDto.sellingPrice,
        supplier: validDto.supplier,
        status: 'ACTIVE',
      }),
    });
    expect(mockTx.medication.update).toHaveBeenCalledWith({
      where: { id: validDto.medicationId },
      data: { stockLevel: { increment: validDto.quantity } },
    });
    expect(result).toEqual({
      id: 'batch-1',
      batchNumber: validDto.batchNumber,
      expiryDate: validDto.expiryDate.toISOString(),
      quantity: validDto.quantity,
      medicationName: medication.name,
    });
  });

  it('should default purchaseDate to now when not provided', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(medication);
    mockPrisma.medicationBatch.findFirst.mockResolvedValue(null);
    mockTx.medicationBatch.create.mockResolvedValue({
      id: 'batch-2',
      batchNumber: validDto.batchNumber,
      expiryDate: validDto.expiryDate,
      quantity: validDto.quantity,
    });

    await useCase.execute(validDto, tenantId);

    expect(mockTx.medicationBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ purchaseDate: expect.any(Date) }),
    });
  });

  it('should reject a negative quantity', async () => {
    await expect(
      useCase.execute({ ...validDto, quantity: -1 }, tenantId)
    ).rejects.toThrow(ValidationError);
    expect(mockPrisma.medication.findFirst).not.toHaveBeenCalled();
  });

  it('should reject a negative unitCost', async () => {
    await expect(
      useCase.execute({ ...validDto, unitCost: -1 }, tenantId)
    ).rejects.toThrow('Quantity, unit cost, and selling price must not be negative');
  });

  it('should reject a negative sellingPrice', async () => {
    await expect(
      useCase.execute({ ...validDto, sellingPrice: -1 }, tenantId)
    ).rejects.toThrow(ValidationError);
  });

  it('should throw NotFoundError when the medication does not exist for the tenant', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(validDto, tenantId)).rejects.toThrow(NotFoundError);
    expect(mockPrisma.medicationBatch.findFirst).not.toHaveBeenCalled();
  });

  it('should throw ConflictError when the batch number already exists for the medication', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(medication);
    mockPrisma.medicationBatch.findFirst.mockResolvedValue({ id: 'existing-batch' });

    await expect(useCase.execute(validDto, tenantId)).rejects.toThrow(ConflictError);
    await expect(useCase.execute(validDto, tenantId)).rejects.toThrow(
      `Batch number ${validDto.batchNumber} already exists for this medication`
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
