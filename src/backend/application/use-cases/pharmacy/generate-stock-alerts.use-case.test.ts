/**
 * Generate Stock Alerts Use Case Tests
 */

import { GenerateStockAlertsUseCase } from './generate-stock-alerts.use-case';
import { NotificationService } from '../../services/notification.service';

jest.mock('../../services/notification.service');

describe('GenerateStockAlertsUseCase', () => {
  let useCase: GenerateStockAlertsUseCase;
  let mockPrisma: any;
  let mockNotifyRole: jest.Mock;

  const tenantId = 'tenant-1';

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      stockAlert: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      medicationBatch: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
    };

    useCase = new GenerateStockAlertsUseCase(mockPrisma);

    mockNotifyRole = (NotificationService as unknown as jest.Mock).mock.instances[0]
      .notifyRole as jest.Mock;
    mockNotifyRole.mockResolvedValue(undefined);
  });

  it('should return an empty list when there is no low stock and no near-expiry batches', async () => {
    const result = await useCase.execute(tenantId);

    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(mockPrisma.medicationBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, status: 'ACTIVE' }),
      })
    );
    expect(result).toEqual([]);
    expect(mockPrisma.stockAlert.create).not.toHaveBeenCalled();
  });

  it('should create an OUT_OF_STOCK alert and notify pharmacists/admins when stock is at or below zero', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'med-1', name: 'Paracetamol', stockLevel: 0, reorderPoint: 20 },
    ]);
    mockPrisma.stockAlert.create.mockResolvedValue({
      id: 'alert-1',
      alertType: 'OUT_OF_STOCK',
      severity: 'CRITICAL',
      message: 'Paracetamol is out of stock',
      createdAt: new Date('2026-01-01'),
    });

    const result = await useCase.execute(tenantId);

    expect(mockPrisma.stockAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId,
        medicationId: 'med-1',
        alertType: 'OUT_OF_STOCK',
        severity: 'CRITICAL',
        status: 'ACTIVE',
      }),
    });
    expect(mockNotifyRole).toHaveBeenCalledWith(
      tenantId,
      ['PHARMACIST', 'ADMIN'],
      expect.objectContaining({ type: 'STOCK_ALERT', title: 'Out of Stock' })
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ medicationName: 'Paracetamol', alertType: 'OUT_OF_STOCK' });
  });

  it('should not duplicate an OUT_OF_STOCK alert that is already ACTIVE', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'med-1', name: 'Paracetamol', stockLevel: 0, reorderPoint: 20 },
    ]);
    mockPrisma.stockAlert.findFirst.mockResolvedValue({ id: 'existing-alert' });

    const result = await useCase.execute(tenantId);

    expect(mockPrisma.stockAlert.create).not.toHaveBeenCalled();
    expect(mockNotifyRole).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('should create a LOW_STOCK alert when stock is positive but at or below the reorder point', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'med-2', name: 'Ibuprofen', stockLevel: 5, reorderPoint: 20 },
    ]);
    mockPrisma.stockAlert.create.mockResolvedValue({
      id: 'alert-2',
      alertType: 'LOW_STOCK',
      severity: 'WARNING',
      message: 'Ibuprofen is low in stock (5 units remaining)',
      createdAt: new Date('2026-01-01'),
    });

    const result = await useCase.execute(tenantId);

    expect(mockPrisma.stockAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ alertType: 'LOW_STOCK', severity: 'WARNING', threshold: 20 }),
    });
    expect(mockNotifyRole).toHaveBeenCalledWith(
      tenantId,
      ['PHARMACIST', 'ADMIN'],
      expect.objectContaining({ title: 'Low Stock' })
    );
    expect(result[0]).toMatchObject({ medicationName: 'Ibuprofen', alertType: 'LOW_STOCK' });
  });

  it('should create an EXPIRED alert and flip the batch status to EXPIRED for a past expiry date', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockPrisma.medicationBatch.findMany.mockResolvedValue([
      {
        id: 'batch-1',
        batchNumber: 'B-001',
        expiryDate: pastDate,
        medication: { id: 'med-3', name: 'Amoxicillin' },
      },
    ]);
    mockPrisma.stockAlert.create.mockResolvedValue({
      id: 'alert-3',
      alertType: 'EXPIRED',
      severity: 'CRITICAL',
      message: 'Amoxicillin batch B-001 has expired',
      createdAt: new Date('2026-01-01'),
    });

    const result = await useCase.execute(tenantId);

    expect(mockPrisma.stockAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ alertType: 'EXPIRED', severity: 'CRITICAL', batchId: 'batch-1' }),
    });
    expect(mockPrisma.medicationBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: { status: 'EXPIRED' },
    });
    expect(mockNotifyRole).toHaveBeenCalledWith(
      tenantId,
      ['PHARMACIST', 'ADMIN'],
      expect.objectContaining({ title: 'Batch Expired' })
    );
    expect(result[0]).toMatchObject({ alertType: 'EXPIRED', batchNumber: 'B-001' });
  });

  it('should create a CRITICAL NEAR_EXPIRY alert when the batch expires within 7 days', async () => {
    const soonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    mockPrisma.medicationBatch.findMany.mockResolvedValue([
      {
        id: 'batch-2',
        batchNumber: 'B-002',
        expiryDate: soonDate,
        medication: { id: 'med-4', name: 'Cough Syrup' },
      },
    ]);
    mockPrisma.stockAlert.create.mockResolvedValue({
      id: 'alert-4',
      alertType: 'NEAR_EXPIRY',
      severity: 'CRITICAL',
      message: 'Cough Syrup batch B-002 expires in 3 days',
      createdAt: new Date('2026-01-01'),
    });

    await useCase.execute(tenantId);

    expect(mockPrisma.stockAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ alertType: 'NEAR_EXPIRY', severity: 'CRITICAL' }),
    });
    expect(mockPrisma.medicationBatch.update).not.toHaveBeenCalled();
  });

  it('should create a WARNING NEAR_EXPIRY alert when the batch expires beyond 7 but within 30 days', async () => {
    const laterDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    mockPrisma.medicationBatch.findMany.mockResolvedValue([
      {
        id: 'batch-3',
        batchNumber: 'B-003',
        expiryDate: laterDate,
        medication: { id: 'med-5', name: 'Vitamin C' },
      },
    ]);
    mockPrisma.stockAlert.create.mockResolvedValue({
      id: 'alert-5',
      alertType: 'NEAR_EXPIRY',
      severity: 'WARNING',
      message: 'Vitamin C batch B-003 expires in 20 days',
      createdAt: new Date('2026-01-01'),
    });

    await useCase.execute(tenantId);

    expect(mockPrisma.stockAlert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ alertType: 'NEAR_EXPIRY', severity: 'WARNING' }),
    });
  });

  it('batches multiple low-stock items into a single notifyRole call instead of one per item', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'med-2', name: 'Ibuprofen', stockLevel: 5, reorderPoint: 20 },
      { id: 'med-7', name: 'Aspirin', stockLevel: 2, reorderPoint: 10 },
    ]);
    mockPrisma.stockAlert.create
      .mockResolvedValueOnce({ id: 'alert-2', alertType: 'LOW_STOCK', severity: 'WARNING', message: 'Ibuprofen is low in stock (5 units remaining)', createdAt: new Date('2026-01-01') })
      .mockResolvedValueOnce({ id: 'alert-7', alertType: 'LOW_STOCK', severity: 'WARNING', message: 'Aspirin is low in stock (2 units remaining)', createdAt: new Date('2026-01-01') });

    const result = await useCase.execute(tenantId);

    const lowStockCalls = mockNotifyRole.mock.calls.filter((call) => call[2].title === 'Low Stock');
    expect(lowStockCalls).toHaveLength(1);
    expect(lowStockCalls[0][2].message).toContain('Ibuprofen');
    expect(lowStockCalls[0][2].message).toContain('Aspirin');
    expect(result).toHaveLength(2);
  });

  it('should not duplicate a NEAR_EXPIRY/EXPIRED alert for a batch that already has one ACTIVE', async () => {
    mockPrisma.medicationBatch.findMany.mockResolvedValue([
      {
        id: 'batch-4',
        batchNumber: 'B-004',
        expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        medication: { id: 'med-6', name: 'Metformin' },
      },
    ]);
    mockPrisma.stockAlert.findFirst.mockResolvedValue({ id: 'existing-alert' });

    const result = await useCase.execute(tenantId);

    expect(mockPrisma.stockAlert.create).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
