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

  it('defaults to a 90-day usedAt bound for the tenant-wide list (no patientId, no explicit range)', async () => {
    mockPrisma.consumableUsage.findMany.mockResolvedValue([]);

    await useCase.execute(tenantId);

    const where = mockPrisma.consumableUsage.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe(tenantId);
    expect(where.isDeleted).toBe(false);
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    expect(Math.abs(where.usedAt.gte.getTime() - ninetyDaysAgo)).toBeLessThan(5000);
  });

  it('does NOT apply a default date bound when scoped to a single patient — an old unbilled item must still surface for invoicing', async () => {
    mockPrisma.consumableUsage.findMany.mockResolvedValue([]);

    await useCase.execute(tenantId, { patientId: 'patient-1' });

    expect(mockPrisma.consumableUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, isDeleted: false, patientId: 'patient-1' },
      })
    );
  });

  it('applies the billingStatus filter alongside the default bound when no patientId is given', async () => {
    mockPrisma.consumableUsage.findMany.mockResolvedValue([]);

    await useCase.execute(tenantId, { billingStatus: 'UNBILLED' });

    const where = mockPrisma.consumableUsage.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ tenantId, isDeleted: false, billingStatus: 'UNBILLED' });
    expect(where.usedAt.gte).toBeInstanceOf(Date);
  });

  it('uses an explicit startDate/endDate instead of the default 90-day bound', async () => {
    mockPrisma.consumableUsage.findMany.mockResolvedValue([]);
    const startDate = new Date('2026-01-01T00:00:00Z');
    const endDate = new Date('2026-02-01T00:00:00Z');

    await useCase.execute(tenantId, { startDate, endDate });

    expect(mockPrisma.consumableUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, isDeleted: false, usedAt: { gte: startDate, lte: endDate } },
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
