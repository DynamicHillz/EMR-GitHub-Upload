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

    // Cannot cancel an invoice with any money already collected FROM THE
    // PATIENT on it. Checked against paidAmount, not paymentStatus — a fully
    // HMO/exemption-covered invoice reads paymentStatus 'PAID' immediately at
    // generation (see generate-invoice.use-case.ts) even though the patient
    // paid nothing, and paymentStatus alone would wrongly block cancelling a
    // mis-billed HMO invoice with no real payment to refund.
    if (Number(existing.paidAmount) > 0) {
      throw new ValidationError('Cannot cancel an invoice with payments recorded against it. Request a refund instead.');
    }

    // Cannot cancel already cancelled invoices
    if (existing.status === 'CANCELLED') {
      throw new ValidationError('Invoice is already cancelled');
    }

    // An auto-created InsuranceClaim (see generate-invoice.use-case.ts) is
    // tied 1:1 to this invoice. If the HMO has already paid it, cancelling
    // here would silently orphan real settled money — block it and require
    // sorting that out with the provider first. Any earlier-stage claim
    // (DRAFT/SUBMITTED/APPROVED/etc.) is safe to cancel automatically below,
    // since nothing has actually been paid out on it yet.
    const existingClaim = await this.prisma.insuranceClaim.findUnique({ where: { invoiceId } });
    if (existingClaim?.status === 'PAID') {
      throw new ValidationError(
        'Cannot cancel an invoice with a PAID insurance claim against it. Settle this with the provider before cancelling.'
      );
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      if (existingClaim) {
        await tx.insuranceClaim.update({
          where: { id: existingClaim.id },
          data: { status: 'CANCELLED' }
        });
      }

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

      // Unbill clinical items so they can be re-billed — every source type
      // generate-invoice.use-case.ts can pull a line item from must be
      // reversed here, or a cancelled invoice permanently strands that
      // item at billingStatus 'BILLED' with no way to ever bill it again.
      const consultationIds = invoiceToCancel?.items.map(i => i.consultationId).filter(id => id) as string[];
      const labOrderIds = invoiceToCancel?.items.map(i => i.labOrderId).filter(id => id) as string[];
      const prescriptionIds = invoiceToCancel?.items.map(i => i.prescriptionId).filter(id => id) as string[];
      const consumableUsageIds = invoiceToCancel?.items.map(i => i.consumableUsageId).filter(id => id) as string[];
      const admissionIds = invoiceToCancel?.items.map(i => i.admissionId).filter(id => id) as string[];
      const transfusionChartIds = invoiceToCancel?.items.map(i => i.transfusionChartId).filter(id => id) as string[];
      const operationNoteIds = invoiceToCancel?.items.map(i => i.operationNoteId).filter(id => id) as string[];
      const laborRecordIds = invoiceToCancel?.items.map(i => i.laborRecordId).filter(id => id) as string[];

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
      if (consumableUsageIds && consumableUsageIds.length > 0) {
        await tx.consumableUsage.updateMany({
          where: { id: { in: consumableUsageIds } },
          data: { billingStatus: 'UNBILLED' }
        });
      }
      if (admissionIds && admissionIds.length > 0) {
        await tx.admission.updateMany({
          where: { id: { in: admissionIds } },
          data: { billingStatus: 'UNBILLED' }
        });
      }
      if (transfusionChartIds && transfusionChartIds.length > 0) {
        await tx.transfusionChart.updateMany({
          where: { id: { in: transfusionChartIds } },
          data: { billingStatus: 'UNBILLED' }
        });
      }
      if (operationNoteIds && operationNoteIds.length > 0) {
        await tx.operationNote.updateMany({
          where: { id: { in: operationNoteIds } },
          data: { billingStatus: 'UNBILLED' }
        });
      }
      if (laborRecordIds && laborRecordIds.length > 0) {
        await tx.laborRecord.updateMany({
          where: { id: { in: laborRecordIds } },
          data: { billingStatus: 'UNBILLED' }
        });
      }

      return updatedInvoice;
    });

    return invoice;
  }
}
