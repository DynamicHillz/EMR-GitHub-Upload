/**
 * Add Medication Use Case Tests
 */

import { AddMedicationUseCase } from './add-medication.use-case';
import { ConflictError, ValidationError } from '../../../shared/errors/AppError';

describe('AddMedicationUseCase', () => {
  let useCase: AddMedicationUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  const validDto = {
    name: 'Paracetamol',
    genericName: 'Acetaminophen',
    brandName: 'Panadol',
    activeIngredient: 'Paracetamol',
    category: 'Analgesic',
    dosageForm: 'Tablet',
    strength: '500mg',
    drugClass: 'Analgesic',
    reorderPoint: 20,
    unitPrice: 50,
    stockLevel: 100,
  };

  beforeEach(() => {
    mockPrisma = {
      medication: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    useCase = new AddMedicationUseCase(mockPrisma);
  });

  it('should create a medication when the name is unique and required fields are present', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(null);
    mockPrisma.medication.create.mockResolvedValue({ id: 'med-1', ...validDto });

    const result = await useCase.execute(validDto, tenantId);

    expect(mockPrisma.medication.findFirst).toHaveBeenCalledWith({
      where: { tenantId, name: validDto.name },
    });
    expect(mockPrisma.medication.create).toHaveBeenCalledWith({
      data: {
        tenantId,
        name: validDto.name,
        genericName: validDto.genericName,
        brandName: validDto.brandName,
        activeIngredient: validDto.activeIngredient,
        category: validDto.category,
        dosageForm: validDto.dosageForm,
        strength: validDto.strength,
        drugClass: validDto.drugClass,
        stockLevel: validDto.stockLevel,
        reorderPoint: validDto.reorderPoint,
        unitPrice: validDto.unitPrice,
      },
    });
    expect(result).toEqual({ id: 'med-1', ...validDto });
  });

  it('should default stockLevel to 0 and reorderPoint to 10 when omitted', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue(null);
    mockPrisma.medication.create.mockResolvedValue({ id: 'med-2' });

    const minimalDto = {
      name: 'Ibuprofen',
      dosageForm: 'Tablet',
      strength: '200mg',
      unitPrice: 30,
    };

    await useCase.execute(minimalDto, tenantId);

    expect(mockPrisma.medication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stockLevel: 0,
        reorderPoint: 10,
        genericName: undefined,
        brandName: undefined,
        activeIngredient: undefined,
        category: undefined,
        drugClass: undefined,
      }),
    });
  });

  it('should reject when dosageForm is missing or blank', async () => {
    await expect(
      useCase.execute({ ...validDto, dosageForm: '' }, tenantId)
    ).rejects.toThrow(ValidationError);
    await expect(
      useCase.execute({ ...validDto, dosageForm: '   ' }, tenantId)
    ).rejects.toThrow('Dosage Form is required');
    expect(mockPrisma.medication.create).not.toHaveBeenCalled();
  });

  it('should reject when strength is missing or blank', async () => {
    await expect(
      useCase.execute({ ...validDto, strength: '' }, tenantId)
    ).rejects.toThrow('Strength is required');
    expect(mockPrisma.medication.create).not.toHaveBeenCalled();
  });

  it('should reject a negative unitPrice', async () => {
    await expect(
      useCase.execute({ ...validDto, unitPrice: -1 }, tenantId)
    ).rejects.toThrow(ValidationError);
    expect(mockPrisma.medication.create).not.toHaveBeenCalled();
  });

  it('should reject a negative stockLevel', async () => {
    await expect(
      useCase.execute({ ...validDto, stockLevel: -5 }, tenantId)
    ).rejects.toThrow('Unit price, stock level, and reorder point must not be negative');
  });

  it('should reject a negative reorderPoint', async () => {
    await expect(
      useCase.execute({ ...validDto, reorderPoint: -1 }, tenantId)
    ).rejects.toThrow(ValidationError);
  });

  it('should reject when a medication with the same name already exists for the tenant', async () => {
    mockPrisma.medication.findFirst.mockResolvedValue({ id: 'existing-med' });

    await expect(useCase.execute(validDto, tenantId)).rejects.toThrow(ConflictError);
    await expect(useCase.execute(validDto, tenantId)).rejects.toThrow(
      'Medication with this name already exists'
    );
    expect(mockPrisma.medication.create).not.toHaveBeenCalled();
  });
});
