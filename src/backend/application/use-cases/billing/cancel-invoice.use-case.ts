/**
 * Cancel Invoice Use Case
 *
 * REQ-BILL-1: Cancel invoice
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export class CancelInvoiceUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(invoiceId: string, tenantId: string, reason?: string) {
    // Check if invoice exists and belongs to tenant
    const existing = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId
      }
    });

    if (!existing) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    // Cannot cancel paid invoices
    if (existing.paymentStatus === 'PAID') {
      throw new ValidationError('Cannot cancel a paid invoice. Request a refund instead.');
    }

    // Cannot cancel already cancelled invoices
    if (existing.status === 'CANCELLED') {
      throw new ValidationError('Invoice is already cancelled');
    }

    const invoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED',
        notes: reason ? `Cancelled: ${reason}` : existing.notes
      }
    });

    return {
      ...invoice,
      lineItems: JSON.parse(invoice.lineItems)
    };
  }
}
