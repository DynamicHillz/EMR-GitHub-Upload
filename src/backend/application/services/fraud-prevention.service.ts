import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';

interface PaymentContext {
  amount: number;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'INSURANCE';
  paymentDate: Date;
  invoiceId: string;
  tenantId: string;
  userId: string;
  receiptPhotoUrl?: string;
  referenceNumber?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface FraudCheckResult {
  requiresApproval: boolean;
  flaggedForReview: boolean;
  flagReason?: string;
  validationErrors: string[];
}

export class FraudPreventionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Comprehensive fraud prevention check for payment recording
   */
  async checkPayment(context: PaymentContext): Promise<FraudCheckResult> {
    const result: FraudCheckResult = {
      requiresApproval: false,
      flaggedForReview: false,
      validationErrors: [],
    };

    // Get tenant's fraud prevention settings
    const settings = await this.prisma.fraudPreventionSettings.findUnique({
      where: { tenantId: context.tenantId },
    });

    if (!settings) {
      // Missing config means "no fraud rules set up yet," not "suspicious" —
      // failing closed here would block every payment for the tenant on a
      // pure config gap. Allow the payment through and log it so an admin
      // notices and configures FraudPreventionSettings.
      logger.warn(`No FraudPreventionSettings configured for tenant ${context.tenantId} — allowing payment without fraud checks`);
      return result;
    }

    // 1. CHECK MANDATORY FIELDS
    this.checkMandatoryFields(context, settings, result);

    // 2. CHECK APPROVAL THRESHOLDS
    this.checkApprovalThresholds(context, settings, result);

    // 3. CHECK BACKDATING RESTRICTIONS
    await this.checkBackdating(context, settings, result);

    // 4. CHECK DUPLICATE PAYMENTS
    if (settings.duplicateDetectionEnabled) {
      await this.checkDuplicates(context, settings, result);
    }

    // 5. CHECK DAILY USER LIMITS
    if (settings.enableDailyLimits) {
      await this.checkDailyLimits(context, settings, result);
    }

    // 6. AUTO-FLAGGING RULES
    this.checkAutoFlagRules(context, settings, result);

    // 7. CHECK OFF-HOURS PAYMENTS
    if (settings.autoFlagOffHoursPayments) {
      this.checkBusinessHours(context, settings, result);
    }

    return result;
  }

  /**
   * Check if mandatory fields are provided based on payment method
   */
  private checkMandatoryFields(
    context: PaymentContext,
    settings: any,
    result: FraudCheckResult
  ): void {
    // Cash payments require receipt photo
    if (
      context.paymentMethod === 'CASH' &&
      settings.requireReceiptPhotoForCash &&
      !context.receiptPhotoUrl
    ) {
      result.validationErrors.push(
        'Receipt photo is mandatory for cash payments'
      );
    }

    // Bank transfer requires reference number
    if (
      context.paymentMethod === 'BANK_TRANSFER' &&
      settings.requireReferenceForBankTransfer &&
      !context.referenceNumber
    ) {
      result.validationErrors.push(
        'Bank reference number is mandatory for bank transfers'
      );
    }

    // Mobile money requires reference number
    if (
      context.paymentMethod === 'MOBILE_MONEY' &&
      settings.requireReferenceForMobileMoney &&
      !context.referenceNumber
    ) {
      result.validationErrors.push(
        'Transaction ID is mandatory for mobile money payments'
      );
    }
  }

  /**
   * Check if payment amount exceeds approval thresholds
   */
  private checkApprovalThresholds(
    context: PaymentContext,
    settings: any,
    result: FraudCheckResult
  ): void {
    let threshold = 0;

    switch (context.paymentMethod) {
      case 'CASH':
        threshold = settings.cashApprovalThreshold;
        break;
      case 'BANK_TRANSFER':
        threshold = settings.bankTransferApprovalThreshold;
        break;
      case 'MOBILE_MONEY':
        threshold = settings.mobileMoneyApprovalThreshold;
        break;
      default:
        return; // No threshold for CARD/INSURANCE
    }

    if (context.amount >= threshold) {
      result.requiresApproval = true;
      result.flagReason = result.flagReason
        ? `${result.flagReason}; Large amount requires approval (₦${context.amount.toLocaleString()})`
        : `Large amount requires supervisor approval (₦${context.amount.toLocaleString()})`;
    }
  }

  /**
   * Check backdating restrictions
   */
  private async checkBackdating(
    context: PaymentContext,
    settings: any,
    result: FraudCheckResult
  ): Promise<void> {
    const now = new Date();
    const paymentDate = new Date(context.paymentDate);
    const daysDifference = Math.floor(
      (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDifference > 0) {
      // Payment is backdated
      if (!settings.allowBackdating) {
        result.validationErrors.push(
          'Backdating payments is not allowed'
        );
      } else if (daysDifference > settings.maxBackdatingDays) {
        result.validationErrors.push(
          `Cannot backdate payments more than ${settings.maxBackdatingDays} days`
        );
      }
    }
  }

  /**
   * Check for duplicate payments
   */
  private async checkDuplicates(
    context: PaymentContext,
    settings: any,
    result: FraudCheckResult
  ): Promise<void> {
    const windowMinutes = settings.duplicateTimeWindowMinutes;
    const tolerancePercent = settings.duplicateAmountTolerancePercent;

    const startTime = new Date(
      Date.now() - windowMinutes * 60 * 1000
    );

    // Calculate amount range with tolerance
    const minAmount = context.amount * (1 - tolerancePercent / 100);
    const maxAmount = context.amount * (1 + tolerancePercent / 100);

    // Find similar payments
    const duplicates = await this.prisma.payment.findMany({
      where: {
        tenantId: context.tenantId,
        invoiceId: context.invoiceId,
        amount: {
          gte: minAmount,
          lte: maxAmount,
        },
        createdAt: {
          gte: startTime,
        },
      },
    });

    if (duplicates.length > 0) {
      result.flaggedForReview = true;
      result.flagReason = result.flagReason
        ? `${result.flagReason}; Possible duplicate payment detected`
        : `Possible duplicate - similar payment recorded ${duplicates.length} time(s) in last ${windowMinutes} minutes`;
    }
  }

  /**
   * Check daily user limits
   */
  private async checkDailyLimits(
    context: PaymentContext,
    settings: any,
    result: FraudCheckResult
  ): Promise<void> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Get user's payments for today
    const todayPayments = await this.prisma.payment.findMany({
      where: {
        tenantId: context.tenantId,
        processedById: context.userId,
        paymentDate: {
          gte: startOfDay,
        },
      },
    });

    // p.amount is a Prisma Decimal — `+` on two Decimals string-concatenates
    // rather than adding (Decimal.valueOf() returns a string), which was
    // silently producing a garbage total/NaN comparison below and disabling
    // this check entirely once a user had more than one payment in a day.
    const totalToday = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const cashToday = todayPayments
      .filter((p) => p.paymentMethod === 'CASH')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // Check total daily limit
    if (
      settings.dailyTotalLimitPerUser &&
      totalToday + context.amount > settings.dailyTotalLimitPerUser
    ) {
      result.validationErrors.push(
        `Daily payment limit exceeded. Today: ₦${totalToday.toLocaleString()}, Limit: ₦${settings.dailyTotalLimitPerUser.toLocaleString()}`
      );
    }

    // Check cash daily limit
    if (
      context.paymentMethod === 'CASH' &&
      settings.dailyCashLimitPerUser &&
      cashToday + context.amount > settings.dailyCashLimitPerUser
    ) {
      result.validationErrors.push(
        `Daily cash payment limit exceeded. Today: ₦${cashToday.toLocaleString()}, Limit: ₦${settings.dailyCashLimitPerUser.toLocaleString()}`
      );
    }
  }

  /**
   * Auto-flagging rules
   */
  private checkAutoFlagRules(
    context: PaymentContext,
    settings: any,
    result: FraudCheckResult
  ): void {
    // Flag large amounts
    if (
      settings.autoFlagLargeAmounts &&
      context.amount >= settings.autoFlagAmountThreshold
    ) {
      result.flaggedForReview = true;
      result.flagReason = result.flagReason
        ? `${result.flagReason}; Unusually large amount (₦${context.amount.toLocaleString()})`
        : `Unusually large amount - exceeds ₦${settings.autoFlagAmountThreshold.toLocaleString()}`;
    }

    // Flag suspiciously round amounts
    if (settings.autoFlagRoundAmounts) {
      const roundAmounts = [
        10000, 20000, 50000, 100000, 200000, 500000, 1000000,
      ];
      if (roundAmounts.includes(context.amount)) {
        result.flaggedForReview = true;
        result.flagReason = result.flagReason
          ? `${result.flagReason}; Suspiciously round amount`
          : 'Suspiciously round amount - verify legitimacy';
      }
    }
  }

  /**
   * Check if payment is recorded outside business hours
   */
  private checkBusinessHours(
    context: PaymentContext,
    settings: any,
    result: FraudCheckResult
  ): void {
    const paymentDate = new Date(context.paymentDate);
    const hours = paymentDate.getHours();
    const minutes = paymentDate.getMinutes();
    const paymentTime = hours * 60 + minutes;

    // Parse business hours
    const [startHour, startMin] = (settings.businessHoursStart || '08:00')
      .split(':')
      .map(Number);
    const [endHour, endMin] = (settings.businessHoursEnd || '18:00')
      .split(':')
      .map(Number);

    const businessStart = startHour * 60 + startMin;
    const businessEnd = endHour * 60 + endMin;

    if (paymentTime < businessStart || paymentTime > businessEnd) {
      result.flaggedForReview = true;
      result.flagReason = result.flagReason
        ? `${result.flagReason}; Payment recorded outside business hours`
        : `Payment recorded outside business hours (${paymentDate.toLocaleTimeString()})`;
    }
  }

  /**
   * Create audit log entry for payment action
   */
  async createAuditLog(data: {
    tenantId: string;
    paymentId: string;
    userId: string;
    action:
      | 'CREATED'
      | 'UPDATED'
      | 'APPROVED'
      | 'REJECTED'
      | 'FLAGGED'
      | 'UNFLAGGED'
      | 'REVIEWED'
      | 'RECONCILED'
      | 'RECEIPT_UPLOADED'
      | 'VOIDED'
      | 'REFUND_INITIATED'
      | 'NOTES_ADDED'
      | 'ACCESSED';
    previousValues?: any;
    newValues?: any;
    changesSummary?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    locationData?: any;
    notes?: string;
  }): Promise<void> {
    await this.prisma.paymentAuditLog.create({
      data: {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tenantId: data.tenantId,
        paymentId: data.paymentId,
        userId: data.userId,
        action: data.action,
        previousValues: data.previousValues || undefined,
        newValues: data.newValues || undefined,
        changesSummary: data.changesSummary,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        deviceId: data.deviceId,
        locationData: data.locationData || undefined,
        notes: data.notes,
      },
    });
  }

  /**
   * Check for multiple payments on same invoice (potential fraud)
   */
  async checkMultiplePaymentsSameInvoice(
    tenantId: string,
    invoiceId: string,
    settings: any
  ): Promise<{ flag: boolean; reason?: string }> {
    if (!settings.autoFlagMultiplePaymentsSameInvoice) {
      return { flag: false };
    }

    // Check how many payments exist for this invoice in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentPayments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        invoiceId,
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    if (recentPayments.length >= 2) {
      return {
        flag: true,
        reason: `Multiple payments (${recentPayments.length + 1}) recorded for same invoice within 1 hour`,
      };
    }

    return { flag: false };
  }
}
