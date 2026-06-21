/**
 * Record Payment Use Case
 *
 * REQ-BILL-2, REQ-BILL-3: Record payments and generate receipts
 * FRAUD PREVENTION: Validates payments against fraud detection rules
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { RecordPaymentDto } from '../../dtos/billing/RecordPayment.dto';
import { FraudPreventionService } from '../../services/fraud-prevention.service';

export class RecordPaymentUseCase {
  private fraudService: FraudPreventionService;

  constructor(private prisma: PrismaClient) {
    this.fraudService = new FraudPreventionService(prisma);
  }

  async execute(
    dto: RecordPaymentDto,
    tenantId: string,
    processedById: string,
    context?: { ipAddress?: string; userAgent?: string; deviceId?: string }
  ) {
    // Validate invoice exists and belongs to tenant
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: dto.invoiceId,
        tenantId
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!invoice) {
      throw new NotFoundError('Invoice', dto.invoiceId);
    }

    // Cannot pay cancelled invoices
    if (invoice.status === 'CANCELLED') {
      throw new ValidationError('Cannot pay a cancelled invoice');
    }

    // Validate payment amount
    if (dto.amount <= 0) {
      throw new ValidationError('Payment amount must be greater than zero');
    }

    if (dto.amount > invoice.balance) {
      throw new ValidationError(`Payment amount (₦${dto.amount}) exceeds invoice balance (₦${invoice.balance})`);
    }

    // ============ FRAUD PREVENTION CHECKS ============
    const fraudCheck = await this.fraudService.checkPayment({
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      paymentDate: dto.paymentDate || new Date(),
      invoiceId: dto.invoiceId,
      tenantId,
      userId: processedById,
      receiptPhotoUrl: dto.receiptPhotoUrl,
      referenceNumber: dto.referenceNumber,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    // Block payment if validation errors exist
    if (fraudCheck.validationErrors.length > 0) {
      throw new ValidationError(
        `Fraud prevention validation failed:\n- ${fraudCheck.validationErrors.join('\n- ')}`
      );
    }

    // Check for multiple payments on same invoice
    const settings = await this.prisma.fraudPreventionSettings.findUnique({
      where: { tenantId },
    });

    if (settings) {
      const multiplePaymentsCheck = await this.fraudService.checkMultiplePaymentsSameInvoice(
        tenantId,
        dto.invoiceId,
        settings
      );

      if (multiplePaymentsCheck.flag) {
        fraudCheck.flaggedForReview = true;
        fraudCheck.flagReason = fraudCheck.flagReason
          ? `${fraudCheck.flagReason}; ${multiplePaymentsCheck.reason}`
          : multiplePaymentsCheck.reason;
      }
    }
    // ================================================

    // Generate payment number
    const paymentNumber = await this.generatePaymentNumber(tenantId);

    // Calculate invoice amounts
    const newPaidAmount = invoice.paidAmount + dto.amount;
    const newBalance = invoice.totalAmount - newPaidAmount;

    let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
    let invoiceStatus: 'DRAFT' | 'ISSUED' | 'FINALIZED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED' | 'REFUNDED' | 'LOCKED';

    if (newBalance === 0) {
      paymentStatus = 'PAID';
      invoiceStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      paymentStatus = 'PARTIALLY_PAID';
      invoiceStatus = 'PARTIALLY_PAID';
    } else {
      paymentStatus = 'UNPAID';
      invoiceStatus = invoice.status;
    }

    // Use transaction to ensure atomicity: payment creation and invoice update must both succeed or both fail
    const result = await this.prisma.$transaction(async (tx) => {
      // Create payment record with fraud prevention fields
      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: dto.invoiceId,
          patientId: invoice.patientId,
          processedById,
          paymentNumber,
          paymentDate: dto.paymentDate || new Date(),
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber,
          transactionId: dto.transactionId,
          cardLast4: dto.cardLast4,
          cardBrand: dto.cardBrand,
          mobileProvider: dto.mobileProvider,
          mobileNumber: dto.mobileNumber,
          status: 'COMPLETED',
          notes: dto.notes,

          // ===== FRAUD PREVENTION FIELDS =====
          receiptPhotoUrl: dto.receiptPhotoUrl,
          proofDocumentUrl: dto.proofDocumentUrl,
          requiresApproval: fraudCheck.requiresApproval,
          flaggedForReview: fraudCheck.flaggedForReview,
          flagReason: fraudCheck.flagReason,
          flaggedAt: fraudCheck.flaggedForReview ? new Date() : null,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          deviceId: context?.deviceId,
          // ===================================
        }
      });

      // Update invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          paymentStatus,
          status: invoiceStatus,
          paymentDate: newBalance === 0 ? new Date() : invoice.paymentDate,
          paymentMethod: dto.paymentMethod
        }
      });

      return { payment, updatedInvoice };
    });

    // Create audit log for payment creation (outside transaction to ensure payment is committed)
    await this.fraudService.createAuditLog({
      tenantId,
      paymentId: result.payment.id,
      userId: processedById,
      action: 'CREATED',
      newValues: result.payment,
      changesSummary: `Payment of ₦${dto.amount.toLocaleString()} recorded via ${dto.paymentMethod}${
        fraudCheck.requiresApproval ? ' (requires approval)' : ''
      }${fraudCheck.flaggedForReview ? ' (flagged for review)' : ''}`,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      deviceId: context?.deviceId,
      notes: fraudCheck.flagReason,
    });

    return {
      payment: result.payment,
      invoice: {
        ...invoice,
        ...result.updatedInvoice,
        paidAmount: newPaidAmount,
        balance: newBalance,
        paymentStatus,
        status: invoiceStatus
      },
      // Include fraud prevention info in response
      fraudPrevention: {
        requiresApproval: fraudCheck.requiresApproval,
        flaggedForReview: fraudCheck.flaggedForReview,
        flagReason: fraudCheck.flagReason,
      }
    };
  }

  private async generatePaymentNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `PAY-${year}${month}${day}`;

    // Count payments created today
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await this.prisma.payment.count({
      where: {
        tenantId,
        paymentDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `${datePrefix}-${sequence}`;
  }
}
