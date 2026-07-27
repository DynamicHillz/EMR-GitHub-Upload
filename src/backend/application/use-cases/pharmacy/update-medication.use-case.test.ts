/**
 * Update Medication Use Case Tests
 */

import { UpdateMedicationUseCase } from './update-medication.use-case';
import { ValidationError } from '../../../shared/errors/AppError';

describe('UpdateMedicationUseCase', () => {
  let useCase: UpdateMedicationUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const id = 'med-1';

  const existing = {
    id,
    tenantId,
    name: 'Paracetamol',
    dosageForm: 'Tablet',
    strength: '500mg',
    reorderPoint: 10,
    unitPrice: 50,
    whoAtcCode: 'N02BE01',
    isEssentialMedicine: true,
  };

  beforeEach(() => {
    mockPrisma = {
      medication: { findFirst: jest.fn(), update: jest.fn() },
    };

    useCase = new UpdateMedicationUseCase(mockPrisma);
  });

  it('should update the medication with the provided fields', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(existing);
    mockPrisma.medication.update.mockResolvedValue({ ...existing, name: 'Paracetamol 500' });

    const dto = {
      name: 'Paracetamol 500',
      dosageForm: 'Tablet',
      strength: '500mg',
      unitPrice: 60,
    };

    const result = await useCase.execute(id, tenantId, dto);

    expect(mockPrisma.medication.findFirst).toHaveBeenCalledWith({ where: { id, tenantId } });
    expect(mockPrisma.medication.update).toHaveBeenCalledWith({
      where: { id },
      data: expect.objectContaining({
        name: 'Paracetamol 500',
        unitPrice: 60,
        dosageForm: 'Tablet',
        strength: '500mg',
      }),
    });
    expect(result.name).toBe('Paracetamol 500');
  });

  it('should fall back to the existing dosageForm/strength when omitted, and default reorderPoint to 10', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(existing);
    mockPrisma.medication.update.mockResolvedValue({});

    await useCase.execute(id, tenantId, { name: 'Paracetamol', unitPrice: 55 });

    expect(mockPrisma.medication.update).toHaveBeenCalledWith({
      where: { id },
      data: expect.objectContaining({
        dosageForm: existing.dosageForm,
        strength: existing.strength,
        reorderPoint: 10,
      }),
    });
  });

  it('should preserve whoAtcCode/isEssentialMedicine from existing when not provided in the dto', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(existing);
    mockPrisma.medication.update.mockResolvedValue({});

    await useCase.execute(id, tenantId, { name: 'Paracetamol', unitPrice: 50 });

    expect(mockPrisma.medication.update).toHaveBeenCalledWith({
      where: { id },
      data: expect.objectContaining({
        whoAtcCode: existing.whoAtcCode,
        isEssentialMedicine: existing.isEssentialMedicine,
      }),
    });
  });

  it('should overwrite whoAtcCode/isEssentialMedicine when explicitly provided in the dto', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(existing);
    mockPrisma.medication.update.mockResolvedValue({});

    await useCase.execute(id, tenantId, {
      name: 'Paracetamol',
      unitPrice: 50,
      whoAtcCode: 'N02BE02',
      isEssentialMedicine: false,
    });

    expect(mockPrisma.medication.update).toHaveBeenCalledWith({
      where: { id },
      data: expect.objectContaining({
        whoAtcCode: 'N02BE02',
        isEssentialMedicine: false,
      }),
    });
  });

  it('should throw when the medication does not exist for the tenant', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute(id, tenantId, { name: 'X', unitPrice: 10 })
    ).rejects.toThrow('Medication not found');
    expect(mockPrisma.medication.update).not.toHaveBeenCalled();
  });

  it('should reject a negative unitPrice', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(existing);

    await expect(
      useCase.execute(id, tenantId, { name: 'Paracetamol', unitPrice: -1 })
    ).rejects.toThrow(ValidationError);
    expect(mockPrisma.medication.update).not.toHaveBeenCalled();
  });

  it('should reject a negative reorderPoint', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(existing);

    await expect(
      useCase.execute(id, tenantId, { name: 'Paracetamol', unitPrice: 50, reorderPoint: -1 })
    ).rejects.toThrow('Unit price and reorder point must not be negative');
  });
});
