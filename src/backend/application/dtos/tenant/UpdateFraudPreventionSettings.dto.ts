/**
 * Update Fraud Prevention Settings DTO
 */

export interface UpdateFraudPreventionSettingsDto {
  cashApprovalThreshold?: number;
  bankTransferApprovalThreshold?: number;
  mobileMoneyApprovalThreshold?: number;
  refundAutoApproveThreshold?: number | null;

  requireReceiptPhotoForCash?: boolean;
  requireReferenceForBankTransfer?: boolean;
  requireReferenceForMobileMoney?: boolean;

  duplicateDetectionEnabled?: boolean;
  duplicateTimeWindowMinutes?: number;
  duplicateAmountTolerancePercent?: number;

  allowBackdating?: boolean;
  maxBackdatingDays?: number;

  enableDailyLimits?: boolean;
  dailyCashLimitPerUser?: number | null;
  dailyTotalLimitPerUser?: number | null;

  autoFlagLargeAmounts?: boolean;
  autoFlagAmountThreshold?: number;
  autoFlagMultiplePaymentsSameInvoice?: boolean;
  autoFlagRoundAmounts?: boolean;
  autoFlagOffHoursPayments?: boolean;

  requireDailyReconciliation?: boolean;
  reconciliationWindowDays?: number;

  businessHoursStart?: string | null;
  businessHoursEnd?: string | null;

  notifyAdminOnFlaggedPayment?: boolean;
  notifyAdminOnLargePayment?: boolean;
}
