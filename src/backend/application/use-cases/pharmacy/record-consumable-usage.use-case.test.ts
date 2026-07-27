/**
 * Record Consumable Usage Use Case Tests
 *
 * Includes the oxygen-therapy fields (flowRateLpm, deliveryMethod,
 * spO2Before, spO2After) and the 0-100 SpO2 bounds validation.
 */

import { RecordConsumableUsageUseCase } from './record-consumable-usage.use-case';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

describe('RecordConsumableUsageUseCase', () => {
  let useCase: RecordConsumableUsageUseCase;
  let mockPrisma: any;
  let mockTx: any;

  const tenantId = 'tenant-1';
  const recordedById = 'user-1';

  const dto = {
    patientId: 'patient-1',
    consumableId: 'cons-1',
    batchId: 'batch-1',
    quantityUsed: 2,
    notes: 'Used during procedure',
  };

  const patient = { id: 'patient-1', tenantId };
  const batch = {
    id: 'batch-1',
    tenantId,
    consumableId: 'cons-1',
    status: 'ACTIVE',
    batchNumber: 'CB-001',
    quantity: 10,
    expiryDate: new Date('2099-01-01'),
    consumable: { name: 'Oxygen Mask' },
  };

  beforeEach(() => {
    mockTx = {
      consumableBatch: { updateMany: jest.fn() },
      consumable: { update: jest.fn() },
      consumableUsage: { create: jest.fn() },
    };

    mockPrisma = {
      patient: { findFirst: jest.fn() },
      consumableBatch: { findFirst: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    useCase = new RecordConsumableUsageUseCase(mockPrisma);
  });

  function setupHappyPath() {
    mockPrisma.patient.findFirst.mockResolvedValue(patient);
    mockPrisma.consumableBatch.findFirst.mockResolvedValue(batch);
    mockTx.consumableBatch.updateMany.mockResolvedValue({ count: 1 });
    mockTx.consumableUsage.create.mockResolvedValue({
      id: 'usage-1',
      quantityUsed: dto.quantityUsed,
      usedAt: new Date('2026-01-01T09:00:00Z'),
    });
  }

  it('should record usage, deduct stock, and return a summary on the happy path', async () => {
    setupHappyPath();

    const result = await useCase.execute(dto, recordedById, tenantId);

    expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith({
      where: { id: dto.patientId, tenantId },
    });
    expect(mockPrisma.consumableBatch.findFirst).toHaveBeenCalledWith({
      where: { id: dto.batchId, tenantId, consumableId: dto.consumableId, status: 'ACTIVE' },
      include: { consumable: true },
    });
    expect(mockTx.consumableBatch.updateMany).toHaveBeenCalledWith({
      where: { id: dto.batchId, tenantId, quantity: { gte: dto.quantityUsed } },
      data: { quantity: { decrement: dto.quantityUsed } },
    });
    expect(mockTx.consumable.update).toHaveBeenCalledWith({
      where: { id: dto.consumableId },
      data: { stockLevel: { decrement: dto.quantityUsed } },
    });
    expect(mockTx.consumableUsage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId,
        consumableId: dto.consumableId,
        batchId: dto.batchId,
        patientId: dto.patientId,
        recordedById,
        quantityUsed: dto.quantityUsed,
        notes: dto.notes,
        billingStatus: 'UNBILLED',
      }),
    });
    expect(result).toEqual({
      id: 'usage-1',
      consumableName: 'Oxygen Mask',
      batchNumber: 'CB-001',
      quantityUsed: dto.quantityUsed,
      usedAt: '2026-01-01T09:00:00.000Z',
    });
  });

  it('should pass through oxygen-therapy fields when provided', async () => {
    setupHappyPath();
    const oxygenDto = {
      ...dto,
      flowRateLpm: 4,
      deliveryMethod: 'Nasal Cannula',
      spO2Before: 88,
      spO2After: 96,
    };

    await useCase.execute(oxygenDto, recordedById, tenantId);

    expect(mockTx.consumableUsage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        flowRateLpm: 4,
        deliveryMethod: 'Nasal Cannula',
        spO2Before: 88,
        spO2After: 96,
      }),
    });
  });

  it('should reject a non-integer or non-positive quantityUsed', async () => {
    await expect(
      useCase.execute({ ...dto, quantityUsed: 0 }, recordedById, tenantId)
    ).rejects.toThrow('quantityUsed must be a positive integer');
    await expect(
      useCase.execute({ ...dto, quantityUsed: 1.5 }, recordedById, tenantId)
    ).rejects.toThrow(ValidationError);
    expect(mockPrisma.patient.findFirst).not.toHaveBeenCalled();
  });

  it('should reject spO2Before below 0 or above 100', async () => {
    await expect(
      useCase.execute({ ...dto, spO2Before: -1 }, recordedById, tenantId)
    ).rejects.toThrow('spO2Before/spO2After must be between 0 and 100');
    await expect(
      useCase.execute({ ...dto, spO2Before: 101 }, recordedById, tenantId)
    ).rejects.toThrow(ValidationError);
    expect(mockPrisma.patient.findFirst).not.toHaveBeenCalled();
  });

  it('should reject spO2After below 0 or above 100', async () => {
    await expect(
      useCase.execute({ ...dto, spO2After: -5 }, recordedById, tenantId)
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute({ ...dto, spO2After: 150 }, recordedById, tenantId)
    ).rejects.toThrow('spO2Before/spO2After must be between 0 and 100');
  });

  it('should accept spO2 boundary values of exactly 0 and 100', async () => {
    setupHappyPath();

    await expect(
      useCase.execute({ ...dto, spO2Before: 0, spO2After: 100 }, recordedById, tenantId)
    ).resolves.toBeDefined();
  });

  it('should throw NotFoundError when the patient does not exist for the tenant', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(dto, recordedById, tenantId)).rejects.toThrow(NotFoundError);
    expect(mockPrisma.consumableBatch.findFirst).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when the ACTIVE batch does not exist for the consumable/tenant', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(patient);
    mockPrisma.consumableBatch.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(dto, recordedById, tenantId)).rejects.toThrow(NotFoundError);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should reject usage from an expired batch', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(patient);
    mockPrisma.consumableBatch.findFirst.mockResolvedValue({
      ...batch,
      expiryDate: new Date('2000-01-01'),
    });

    await expect(useCase.execute(dto, recordedById, tenantId)).rejects.toThrow(
      `Batch ${batch.batchNumber} has expired`
    );
  });

  it('should allow a batch with no expiryDate at all', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(patient);
    mockPrisma.consumableBatch.findFirst.mockResolvedValue({ ...batch, expiryDate: null });
    mockTx.consumableBatch.updateMany.mockResolvedValue({ count: 1 });
    mockTx.consumableUsage.create.mockResolvedValue({
      id: 'usage-2',
      quantityUsed: dto.quantityUsed,
      usedAt: new Date('2026-01-01T09:00:00Z'),
    });

    await expect(useCase.execute(dto, recordedById, tenantId)).resolves.toBeDefined();
  });

  it('should reject when the batch has insufficient stock', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(patient);
    mockPrisma.consumableBatch.findFirst.mockResolvedValue({ ...batch, quantity: 1 });

    await expect(useCase.execute(dto, recordedById, tenantId)).rejects.toThrow(
      'Insufficient stock. Available: 1, Required: 2'
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should reject inside the transaction when a concurrent usage record already consumed the stock', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(patient);
    mockPrisma.consumableBatch.findFirst.mockResolvedValue(batch);
    mockTx.consumableBatch.updateMany.mockResolvedValue({ count: 0 });

    await expect(useCase.execute(dto, recordedById, tenantId)).rejects.toThrow(
      'Insufficient stock — it may have just been used by someone else'
    );
    expect(mockTx.consumable.update).not.toHaveBeenCalled();
    expect(mockTx.consumableUsage.create).not.toHaveBeenCalled();
  });
});
