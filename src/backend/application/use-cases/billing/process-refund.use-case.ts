/**
 * Process Refund Use Case
 *
 * REQ-BILL-5: Complete approved refund and update invoice
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
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

    // Calculate invoice amounts
    const invoice = refund.invoice;
    const newPaidAmount = invoice.paidAmount - refund.amount;
    const newBalance = invoice.totalAmount - newPaidAmount;

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

    // Use transaction to ensure atomicity: refund, invoice, and payment updates must all succeed or all fail
    const result = await this.prisma.$transaction(async (tx) => {
      // Update refund status
      const updatedRefund = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: 'COMPLETED',
          referenceNumber: dto.referenceNumber,
          refundDate: new Date()
        }
      });

      // Update invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id: refund.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          paymentStatus,
          status: invoiceStatus
        }
      });

      // Update payment status if specific payment was refunded
      if (refund.paymentId) {
        await tx.payment.update({
          where: { id: refund.paymentId },
          data: {
            status: 'REFUNDED'
          }
        });
      }

      return { updatedRefund, updatedInvoice };
    });

    return {
      refund: result.updatedRefund,
      invoice: {
        ...invoice,
        ...result.updatedInvoice,
        paidAmount: newPaidAmount,
        balance: newBalance,
        paymentStatus,
        status: invoiceStatus
      }
    };
  }
}
