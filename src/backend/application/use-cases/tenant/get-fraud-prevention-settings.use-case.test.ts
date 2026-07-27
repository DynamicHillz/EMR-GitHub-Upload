/**
 * Get Fraud Prevention Settings Use Case Tests
 *
 * Covers both the real-row path and the "tenant never had settings
 * seeded" fallback, since callers depend on always getting a usable
 * settings shape back (never null).
 */

import { GetFraudPreventionSettingsUseCase } from './get-fraud-prevention-settings.use-case';

describe('GetFraudPreventionSettingsUseCase', () => {
  let useCase: GetFraudPreventionSettingsUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  const mockSettings = {
    id: 'settings-uuid-1',
    tenantId,
    cashApprovalThreshold: 60000,
    bankTransferApprovalThreshold: 120000,
    mobileMoneyApprovalThreshold: 80000,
    refundAutoApproveThreshold: 5000,
    requireReceiptPhotoForCash: true,
    requireReferenceForBankTransfer: true,
    requireReferenceForMobileMoney: true,
    duplicateDetectionEnabled: true,
    duplicateTimeWindowMinutes: 45,
    duplicateAmountTolerancePercent: 5,
    allowBackdating: true,
    maxBackdatingDays: 3,
    enableDailyLimits: true,
    dailyCashLimitPerUser: 100000,
    dailyTotalLimitPerUser: 200000,
    autoFlagLargeAmounts: true,
    autoFlagAmountThreshold: 250000,
    autoFlagMultiplePaymentsSameInvoice: true,
    autoFlagRoundAmounts: true,
    autoFlagOffHoursPayments: true,
    requireDailyReconciliation: true,
    reconciliationWindowDays: 5,
    businessHoursStart: '09:00',
    businessHoursEnd: '17:00',
    notifyAdminOnFlaggedPayment: true,
    notifyAdminOnLargePayment: true,
    updatedAt: new Date('2026-07-27T00:00:00.000Z'),
  };

  beforeEach(() => {
    mockPrisma = {
      fraudPreventionSettings: { findUnique: jest.fn() },
    };

    useCase = new GetFraudPreventionSettingsUseCase(mockPrisma);
  });

  it('should query settings scoped by tenantId and return the stored row when it exists', async () => {
    mockPrisma.fraudPreventionSettings.findUnique.mockResolvedValue(mockSettings);

    const result = await useCase.execute(tenantId);

    expect(mockPrisma.fraudPreventionSettings.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId } })
    );
    expect(result).toEqual(mockSettings);
  });

  it('should return schema-default settings when the tenant has no stored row', async () => {
    mockPrisma.fraudPreventionSettings.findUnique.mockResolvedValue(null);

    const result = await useCase.execute(tenantId);

    expect(result).toEqual({
      id: null,
      tenantId,
      cashApprovalThreshold: 50000,
      bankTransferApprovalThreshold: 100000,
      mobileMoneyApprovalThreshold: 75000,
      refundAutoApproveThreshold: null,
      requireReceiptPhotoForCash: true,
      requireReferenceForBankTransfer: true,
      requireReferenceForMobileMoney: true,
      duplicateDetectionEnabled: true,
      duplicateTimeWindowMinutes: 30,
      duplicateAmountTolerancePercent: 0,
      allowBackdating: false,
      maxBackdatingDays: 0,
      enableDailyLimits: false,
      dailyCashLimitPerUser: null,
      dailyTotalLimitPerUser: null,
      autoFlagLargeAmounts: true,
      autoFlagAmountThreshold: 200000,
      autoFlagMultiplePaymentsSameInvoice: true,
      autoFlagRoundAmounts: false,
      autoFlagOffHoursPayments: false,
      requireDailyReconciliation: true,
      reconciliationWindowDays: 7,
      businessHoursStart: '08:00',
      businessHoursEnd: '18:00',
      notifyAdminOnFlaggedPayment: true,
      notifyAdminOnLargePayment: true,
      updatedAt: null,
    });
  });
});
