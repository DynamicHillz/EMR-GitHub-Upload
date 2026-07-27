/**
 * Get Consumable Usage Use Case Tests
 */

import { GetConsumableUsageUseCase } from './get-consumable-usage.use-case';

describe('GetConsumableUsageUseCase', () => {
  let useCase: GetConsumableUsageUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  const record = {
    id: 'usage-1',
    consumableId: 'cons-1',
    consumable: { name: 'Syringe', unit: 'piece' },
    batch: { batchNumber: 'B-1', sellingPrice: 8 },
    quantityUsed: 3,
    patientId: 'patient-1',
    admissionId: null,
    consultationId: null,
    billingStatus: 'UNBILLED',
    notes: null,
    usedAt: new Date('2026-01-01T00:00:00Z'),
    recordedBy: { firstName: 'Jane', lastName: 'Smith' },
  };

  beforeEach(() => {
    mockPrisma = {
      consumableUsage: { findMany: jest.fn() },
    };

    useCase = new GetConsumableUsageUseCase(mockPrisma);
  });

  it('should query non-deleted usage records scoped to the tenant with no extra filters by default', async () => {
    mockPrisma.consumableUsage.findMany.mockResolvedValue([]);

    await useCase.execute(tenantId);

    expect(mockPrisma.consumableUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, isDeleted: false },
        orderBy: { usedAt: 'desc' },
      })
    );
  });

  it('should apply the patientId filter when provided', async () => {
    mockPrisma.consumableUsage.findMany.mockResolvedValue([]);

    await useCase.execute(tenantId, { patientId: 'patient-1' });

    expect(mockPrisma.consumableUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, isDeleted: false, patientId: 'patient-1' },
      })
    );
  });

  it('should apply the billingStatus filter when provided', async () => {
    mockPrisma.consumableUsage.findMany.mockResolvedValue([]);

    await useCase.execute(tenantId, { billingStatus: 'UNBILLED' });

    expect(mockPrisma.consumableUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, isDeleted: false, billingStatus: 'UNBILLED' },
      })
    );
  });

  it('should compute the line total from sellingPrice * quantityUsed and shape the response', async () => {
    mockPrisma.consumableUsage.findMany.mockResolvedValue([record]);

    const result = await useCase.execute(tenantId);

    expect(result).toEqual([
      {
        id: 'usage-1',
        consumableId: 'cons-1',
        consumableName: 'Syringe',
        unit: 'piece',
        batchNumber: 'B-1',
        unitPrice: 8,
        quantityUsed: 3,
        total: 24,
        patientId: 'patient-1',
        admissionId: null,
        consultationId: null,
        billingStatus: 'UNBILLED',
        notes: null,
        usedAt: record.usedAt.toISOString(),
        recordedByName: 'Jane Smith',
      },
    ]);
  });

  it('should return an empty array when there are no usage records', async () => {
    mockPrisma.consumableUsage.findMany.mockResolvedValue([]);

    const result = await useCase.execute(tenantId);

    expect(result).toEqual([]);
  });
});
