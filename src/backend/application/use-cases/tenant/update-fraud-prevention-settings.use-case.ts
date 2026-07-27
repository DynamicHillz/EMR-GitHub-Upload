/**
 * Update Fraud Prevention Settings Use Case
 *
 * Upserts (rather than requiring a pre-existing row) since a tenant may
 * never have had scripts/apply-fraud-prevention.js run against it —
 * saving from the new admin UI must work either way.
 */

import { PrismaClient } from '@prisma/client';
import { ValidationError, NotFoundError } from '../../../shared/errors/AppError';
import { UpdateFraudPreventionSettingsDto } from '../../dtos/tenant/UpdateFraudPreventionSettings.dto';

export class UpdateFraudPreventionSettingsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, dto: UpdateFraudPreventionSettingsDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    for (const [field, value] of Object.entries(dto)) {
      if (typeof value === 'number' && value < 0) {
        throw new ValidationError(`${field} cannot be negative`);
      }
    }
    if (dto.duplicateAmountTolerancePercent !== undefined && dto.duplicateAmountTolerancePercent > 100) {
      throw new ValidationError('duplicateAmountTolerancePercent cannot exceed 100');
    }

    const data = { ...dto };

    const updated = await this.prisma.fraudPreventionSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
      select: {
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
      },
    });

    return updated;
  }
}
