/**
 * Get Stock Alerts Use Case Tests
 */

import { GetStockAlertsUseCase } from './get-stock-alerts.use-case';

describe('GetStockAlertsUseCase', () => {
  let useCase: GetStockAlertsUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  const alert = {
    id: 'alert-1',
    medicationId: 'med-1',
    medication: { name: 'Paracetamol' },
    batchId: 'batch-1',
    batch: { batchNumber: 'B-1' },
    alertType: 'LOW_STOCK',
    severity: 'WARNING',
    message: 'Paracetamol is low in stock',
    status: 'ACTIVE',
    threshold: 20,
    createdAt: new Date('2026-01-01'),
    acknowledgedAt: null,
    resolvedAt: null,
  };

  beforeEach(() => {
    mockPrisma = {
      stockAlert: { findMany: jest.fn() },
    };

    useCase = new GetStockAlertsUseCase(mockPrisma);
  });

  it('should default to ACTIVE status when no status filter is given', async () => {
    mockPrisma.stockAlert.findMany.mockResolvedValue([]);

    await useCase.execute({}, tenantId);

    expect(mockPrisma.stockAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, status: 'ACTIVE' },
      })
    );
  });

  it('should apply status, severity, and alertType filters when provided', async () => {
    mockPrisma.stockAlert.findMany.mockResolvedValue([]);

    await useCase.execute(
      { status: 'RESOLVED', severity: 'CRITICAL', alertType: 'EXPIRED' },
      tenantId
    );

    expect(mockPrisma.stockAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, status: 'RESOLVED', severity: 'CRITICAL', alertType: 'EXPIRED' },
      })
    );
  });

  it('should shape the response including optional batch/threshold/timestamp fields', async () => {
    mockPrisma.stockAlert.findMany.mockResolvedValue([alert]);

    const result = await useCase.execute({}, tenantId);

    expect(result).toEqual([
      {
        id: 'alert-1',
        medicationId: 'med-1',
        medicationName: 'Paracetamol',
        batchId: 'batch-1',
        batchNumber: 'B-1',
        alertType: 'LOW_STOCK',
        severity: 'WARNING',
        message: 'Paracetamol is low in stock',
        status: 'ACTIVE',
        threshold: 20,
        createdAt: alert.createdAt.toISOString(),
        acknowledgedAt: undefined,
        resolvedAt: undefined,
      },
    ]);
  });

  it('should return batchId/batchNumber/threshold as undefined when the alert has none', async () => {
    mockPrisma.stockAlert.findMany.mockResolvedValue([
      { ...alert, batchId: null, batch: null, threshold: null },
    ]);

    const result = await useCase.execute({}, tenantId);

    expect(result[0].batchId).toBeUndefined();
    expect(result[0].batchNumber).toBeUndefined();
    expect(result[0].threshold).toBeUndefined();
  });

  it('should return an empty array when there are no matching alerts', async () => {
    mockPrisma.stockAlert.findMany.mockResolvedValue([]);

    const result = await useCase.execute({}, tenantId);

    expect(result).toEqual([]);
  });
});
