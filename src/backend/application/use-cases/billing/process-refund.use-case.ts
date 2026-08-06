/**
 * Process Refund Use Case
 *
 * REQ-BILL-5: Complete approved refund and update invoice
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../../../shared/errors/AppError';
import { ProcessRefundDto } from '../../dtos/billing/ProcessRefund.dto';

export class ProcessRefundUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(refundId: string, dto: ProcessRefundDto, tenantId: string) {
    // Validate refund exists and is approved
    const refund = await this.prisma.refund.findFirst({
      where: {
        id: refundId,
        tenantId
      },
      include: {
        invoice: true,
        payment: true
      }
    });

    if (!refund) {
      throw new NotFoundError('Refund', refundId);
    }

    if (refund.status !== 'APPROVED') {
      throw new ValidationError('Refund must be approved before processing');
    }

    // Use transaction to ensure atomicity: refund, invoice, and payment updates must all succeed or all fail.
    // Both the refund's own status transition and the invoice update are
    // guarded so two concurrent "process this refund" calls (or a refund
    // racing a payment on the same invoice) can't both apply their delta.
    const result = await this.prisma.$transaction(async (tx) => {
      const refundUpdateResult = await tx.refund.updateMany({
        where: { id: refundId, tenantId, status: 'APPROVED' },
        data: {
          status: 'COMPLETED',
          referenceNumber: dto.referenceNumber,
          refundDate: new Date()
        }
      });

      if (refundUpdateResult.count === 0) {
        throw new ConflictError('This refund was already processed by another request.');
      }

      const current = await tx.invoice.findUniqueOrThrow({ where: { id: refund.invoiceId } });
      const newPaidAmount = Number(current.paidAmount) - Number(refund.amount);
      // current.balance, not totalAmount — see record-payment.use-case.ts.
      // A refund gives money back, so it increases what's still outstanding
      // by exactly the refunded amount; deriving from totalAmount instead
      // would silently reintroduce any insurance-covered portion as owed.
      const newBalance = Number(current.balance) + Number(refund.amount);

      // request-refund only validates a new request against the invoice's
      // *current* paidAmount, which doesn't move until a refund is actually
      // processed — so two refund requests can each individually look valid
      // before either is processed. This is the last line of defense against
      // that: refuse to let paidAmount go negative no matter how it got here.
      if (newPaidAmount < 0) {
        throw new ValidationError(
          'This refund would exceed the amount actually paid on this invoice — another refund may have already been processed.'
        );
      }

      let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
      let invoiceStatus: 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED' | 'REFUNDED';

      if (newPaidAmount === 0) {
        paymentStatus = 'REFUNDED';
        invoiceStatus = 'REFUNDED';
      } else if (newPaidAmount > 0 && newBalance > 0) {
        paymentStatus = 'PARTIALLY_PAID';
        invoiceStatus = 'PARTIALLY_PAID';
      } else {
        paymentStatus = 'PAID';
        invoiceStatus = 'PAID';
      }

      const invoiceUpdateResult = await tx.invoice.updateMany({
        where: { id: refund.invoiceId, paidAmount: current.paidAmount },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          paymentStatus,
          status: invoiceStatus
        }
      });

      if (invoiceUpdateResult.count === 0) {
        throw new ConflictError('This invoice was modified concurrently — please retry.');
      }

      // Update payment status if specific payment was refunded
      if (refund.paymentId) {
        await tx.payment.update({
          where: { id: refund.paymentId },
          data: {
            status: 'REFUNDED'
          }
        });
      }

      const updatedRefund = await tx.refund.findUniqueOrThrow({ where: { id: refundId } });
      const updatedInvoice = await tx.invoice.findUniqueOrThrow({ where: { id: refund.invoiceId } });
      return { updatedRefund, updatedInvoice };
    });

    return {
      refund: result.updatedRefund,
      invoice: result.updatedInvoice
    };
  }
}
