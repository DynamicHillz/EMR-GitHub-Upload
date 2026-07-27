/**
 * Get Fraud Prevention Settings Use Case
 *
 * Full admin-facing settings record (contrast with
 * billing.controller.ts's getFraudPreventionSettingsForPaymentForm, which
 * only exposes the narrow subset the payment form itself needs).
 */

import { PrismaClient } from '@prisma/client';

const SELECT = {
  id: true,
  tenantId: true,
  cashApprovalThreshold: true,
  bankTransferApprovalThreshold: true,
  mobileMoneyApprovalThreshold: true,
  refundAutoApproveThreshold: true,
  requireReceiptPhotoForCash: true,
  requireReferenceForBankTransfer: true,
  requireReferenceForMobileMoney: true,
  duplicateDetectionEnabled: true,
  duplicateTimeWindowMinutes: true,
  duplicateAmountTolerancePercent: true,
  allowBackdating: true,
  maxBackdatingDays: true,
  enableDailyLimits: true,
  dailyCashLimitPerUser: true,
  dailyTotalLimitPerUser: true,
  autoFlagLargeAmounts: true,
  autoFlagAmountThreshold: true,
  autoFlagMultiplePaymentsSameInvoice: true,
  autoFlagRoundAmounts: true,
  autoFlagOffHoursPayments: true,
  requireDailyReconciliation: true,
  reconciliationWindowDays: true,
  businessHoursStart: true,
  businessHoursEnd: true,
  notifyAdminOnFlaggedPayment: true,
  notifyAdminOnLargePayment: true,
  updatedAt: true,
} as const;

export class GetFraudPreventionSettingsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string) {
    const settings = await this.prisma.fraudPreventionSettings.findUnique({
      where: { tenantId },
      select: SELECT,
    });

    // No row yet (tenant never had scripts/apply-fraud-prevention.js run
    // against it) — return the schema's own defaults rather than null, so
    // the admin form always has something sensible to show/save over.
    if (settings) return settings;

    return {
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
    };
  }
}
