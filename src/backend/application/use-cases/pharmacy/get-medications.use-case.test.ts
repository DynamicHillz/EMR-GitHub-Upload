/**
 * Get Medications Use Case Tests
 */

import { GetMedicationsUseCase } from './get-medications.use-case';

describe('GetMedicationsUseCase', () => {
  let useCase: GetMedicationsUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  beforeEach(() => {
    mockPrisma = {
      medication: { findMany: jest.fn() },
    };

    useCase = new GetMedicationsUseCase(mockPrisma);
  });

  it('should query medications scoped to the tenant, ordered by name', async () => {
    mockPrisma.medication.findMany.mockResolvedValue([]);

    await useCase.execute(tenantId);

    expect(mockPrisma.medication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId },
        orderBy: { name: 'asc' },
      })
    );
  });

  it('should map decimal/nullable fields to plain numbers and undefined', async () => {
    mockPrisma.medication.findMany.mockResolvedValue([
      {
        id: 'med-1',
        name: 'Paracetamol',
        genericName: null,
        brandName: null,
        category: null,
        strength: '500mg',
        dosageForm: 'Tablet',
        drugClass: null,
        unitPrice: { toString: () => '50' } as any,
        reorderPoint: null,
        stockLevel: null,
        isControlledSubstance: false,
        scheduleClass: null,
      },
    ]);
    // Number() on a Prisma Decimal-like object with a numeric toString works
    // the same way it does against the real Decimal type.
    mockPrisma.medication.findMany.mockResolvedValueOnce([
      {
        id: 'med-1',
        name: 'Paracetamol',
        genericName: null,
        brandName: null,
        category: null,
        strength: '500mg',
        dosageForm: 'Tablet',
        drugClass: null,
        unitPrice: 50,
        reorderPoint: null,
        stockLevel: null,
        isControlledSubstance: false,
        scheduleClass: null,
      },
    ]);

    const result = await useCase.execute(tenantId);

    expect(result).toEqual([
      {
        id: 'med-1',
        name: 'Paracetamol',
        genericName: undefined,
        brandName: undefined,
        category: undefined,
        strength: '500mg',
        dosageForm: 'Tablet',
        drugClass: undefined,
        unitPrice: 50,
        reorderPoint: undefined,
        stockLevel: undefined,
        isControlledSubstance: false,
        scheduleClass: undefined,
      },
    ]);
  });

  it('should return an empty array when there are no medications', async () => {
    mockPrisma.medication.findMany.mockResolvedValue([]);

    const result = await useCase.execute(tenantId);

    expect(result).toEqual([]);
  });
});
