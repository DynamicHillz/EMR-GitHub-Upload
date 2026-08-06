/**
 * Record Payment Use Case
 *
 * REQ-BILL-2, REQ-BILL-3: Record payments and generate receipts
 * FRAUD PREVENTION: Validates payments against fraud detection rules
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../../../shared/errors/AppError';
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

    // Validate payment amount — isNaN check first: `NaN <= 0` and
    // `NaN > x` are both false in JS, so a malformed amount (e.g. from an
    // unparsed request field) would otherwise sail through both checks
    // below and get written straight into a Decimal column.
    if (isNaN(dto.amount) || dto.amount <= 0) {
      throw new ValidationError('Payment amount must be a valid positive number');
    }

    if (dto.amount > Number(invoice.balance)) {
      throw new ValidationError(`Payment amount (₦${dto.amount}) exceeds invoice balance (₦${invoice.balance})`);
    }

    // The person physically receiving cash isn't always the person logged
    // in recording it — require it explicitly rather than assuming
    // processedById always matches who took the money.
    if (dto.paymentMethod === 'CASH' && !dto.cashReceivedByName?.trim()) {
      throw new ValidationError('Cash payments require the name of the staff member who received the cash.');
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

    // Above the tenant's configured threshold, an approver must actually be
    // named — otherwise "requires approval" was only ever a label, never a gate.
    if (fraudCheck.requiresApproval && !dto.approverName?.trim()) {
      throw new ValidationError(
        'This payment exceeds the approval threshold and requires an approver name before it can be recorded.'
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

    // A flagged duplicate must actually require an approver, same as an
    // over-threshold payment — otherwise "flagged for review" was only ever
    // a label attached to a payment that already went through unchanged.
    if (fraudCheck.flaggedForReview && !dto.approverName?.trim()) {
      throw new ValidationError(
        `This payment was flagged for review (${fraudCheck.flagReason}) and requires an approver name before it can be recorded.`
      );
    }
    // ================================================

    // Generate payment number
    const paymentNumber = await this.generatePaymentNumber(tenantId);

    // Use transaction to ensure atomicity: payment creation and invoice update must both succeed or both fail.
    // Amounts are computed from a fresh re-read taken INSIDE the transaction,
    // and the invoice update is guarded on that same paidAmount — if another
    // concurrent payment commits first, this update matches zero rows and
    // throws a ConflictError instead of both payments silently overwriting
    // each other's contribution to the running balance.
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.invoice.findUniqueOrThrow({ where: { id: dto.invoiceId } });

      const newPaidAmount = Number(current.paidAmount) + dto.amount;
      // current.balance — not totalAmount — is the anchor: totalAmount is the
      // FULL billed amount (including any insurance-covered portion, which
      // the patient never owed), while balance already tracks only what's
      // left of the patient's own out-of-pocket responsibility. Decrementing
      // it directly preserves that invariant regardless of exemptions/HMO/
      // copay coverage; re-deriving from totalAmount silently added the
      // insurance-covered portion back as if the patient still owed it.
      const newBalance = Number(current.balance) - dto.amount;

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
        invoiceStatus = current.status;
      }

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
          cashReceivedByName: dto.paymentMethod === 'CASH' ? dto.cashReceivedByName?.trim() : undefined,
          status: 'COMPLETED',
          notes: dto.notes,

          // ===== FRAUD PREVENTION FIELDS =====
          receiptPhotoUrl: dto.receiptPhotoUrl,
          proofDocumentUrl: dto.proofDocumentUrl,
          requiresApproval: fraudCheck.requiresApproval,
          verificationNotes: (fraudCheck.requiresApproval || fraudCheck.flaggedForReview) ? `Approved by: ${dto.approverName?.trim()}` : undefined,
          flaggedForReview: fraudCheck.flaggedForReview,
          flagReason: fraudCheck.flagReason,
          flaggedAt: fraudCheck.flaggedForReview ? new Date() : null,
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          deviceId: context?.deviceId,
          // ===================================
        }
      });

      // Update invoice — guarded on the paidAmount just re-read above
      const updateResult = await tx.invoice.updateMany({
        where: { id: dto.invoiceId, paidAmount: current.paidAmount },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          paymentStatus,
          status: invoiceStatus,
          paymentDate: newBalance === 0 ? new Date() : current.paymentDate,
          paymentMethod: dto.paymentMethod,
        }
      });

      if (updateResult.count === 0) {
        throw new ConflictError('This invoice was modified by another payment at the same time — please retry.');
      }

      await tx.invoiceAuditLog.create({
        data: {
          tenantId,
          invoiceId: dto.invoiceId,
          userId: processedById,
          action: paymentStatus === 'PAID' ? 'FULLY_PAID' : 'PARTIALLY_PAID',
          notes: `Payment of ₦${dto.amount} received`,
          previousValues: { balance: Number(current.balance), status: current.status, paidAmount: Number(current.paidAmount) } as any,
          newValues: { balance: newBalance, status: invoiceStatus, paidAmount: newPaidAmount } as any
        }
      });

      return { payment, newPaidAmount, newBalance, paymentStatus, invoiceStatus };
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
        paidAmount: result.newPaidAmount,
        balance: result.newBalance,
        paymentStatus: result.paymentStatus,
        status: result.invoiceStatus
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
