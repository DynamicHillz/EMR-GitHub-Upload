/**
 * Cancel Invoice Use Case
 *
 * REQ-BILL-1: Cancel invoice
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export class CancelInvoiceUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(invoiceId: string, tenantId: string, userId?: string, reason?: string) {
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

    // Cannot cancel an invoice with any money already collected on it — used
    // to only block fully PAID, so a PARTIALLY_PAID invoice could be
    // cancelled (soft-deleted, dropping out of the default invoice list)
    // while its Payment row(s) — real collected money — were left stranded
    // with no compensating refund and no forced reconciliation step.
    if (existing.paymentStatus !== 'UNPAID') {
      throw new ValidationError('Cannot cancel an invoice with payments recorded against it. Request a refund instead.');
    }

    // Cannot cancel already cancelled invoices
    if (existing.status === 'CANCELLED') {
      throw new ValidationError('Invoice is already cancelled');
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      const invoiceToCancel = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true }
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'CANCELLED',
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          notes: reason ? `Cancelled: ${reason}` : existing.notes,
          auditLogs: {
            create: {
              tenantId,
              userId: userId || 'system',
              action: 'CANCELLED',
              notes: reason ? `Cancelled: ${reason}` : 'Invoice cancelled',
              previousValues: { status: existing.status } as any,
              newValues: { status: 'CANCELLED' } as any
            }
          }
        },
        include: { items: true }
      });

      // Unbill clinical items so they can be re-billed
      const consultationIds = invoiceToCancel?.items.map(i => i.consultationId).filter(id => id) as string[];
      const labOrderIds = invoiceToCancel?.items.map(i => i.labOrderId).filter(id => id) as string[];
      const prescriptionIds = invoiceToCancel?.items.map(i => i.prescriptionId).filter(id => id) as string[];

      if (consultationIds && consultationIds.length > 0) {
        await tx.consultation.updateMany({
          where: { id: { in: consultationIds } },
          data: { billingStatus: 'UNBILLED' }
        });
      }
      if (labOrderIds && labOrderIds.length > 0) {
        await tx.labOrder.updateMany({
          where: { id: { in: labOrderIds } },
          data: { billingStatus: 'UNBILLED' }
        });
      }
      if (prescriptionIds && prescriptionIds.length > 0) {
        await tx.prescription.updateMany({
          where: { id: { in: prescriptionIds } },
          data: { billingStatus: 'UNBILLED' }
        });
      }

      return updatedInvoice;
    });

    return invoice;
  }
}
