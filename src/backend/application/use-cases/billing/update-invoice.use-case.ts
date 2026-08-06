/**
 * Update Invoice Use Case
 *
 * REQ-BILL-1: Update draft invoices
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../../../shared/errors/AppError';

export interface UpdateInvoiceDto {
  discount?: number;
  notes?: string;
  dueDate?: Date;
  version?: number; // expected version, for optimistic-concurrency conflict detection
}

export class UpdateInvoiceUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(invoiceId: string, dto: UpdateInvoiceDto, tenantId: string, userId: string) {
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

    // Only allow updates to DRAFT or ISSUED invoices
    if (existing.status !== 'DRAFT' && existing.status !== 'ISSUED') {
      throw new ValidationError('Cannot update invoice in current status');
    }

    // Bound the discount — previously unbounded, so a CASHIER could submit
    // an arbitrary discount and drive totalAmount/balance negative on an
    // already-issued invoice with no approval step (unlike the refund
    // workflow, which requires a separate ADMIN role). subtotal/taxAmount
    // don't move with concurrent payments, so checking against `existing`
    // here (outside the transaction below) is fine.
    if (dto.discount !== undefined) {
      const totalBeforeDiscount = Number(existing.subtotal) + Number(existing.taxAmount);
      if (dto.discount < 0 || dto.discount > totalBeforeDiscount) {
        throw new ValidationError(`Discount must be between 0 and ${totalBeforeDiscount}`);
      }
    }

    // Version check and the actual data write used to be two separate,
    // non-transactional round trips, with `balance` computed from a
    // `paidAmount` read at the very top of this function — a payment
    // recorded in the window between the version check and the final write
    // would get silently overwritten by a `balance` computed from that now
    // stale (too-high) paidAmount. Single transaction now, with paidAmount
    // re-read immediately before computing balance.
    const invoice = await this.prisma.$transaction(async (tx) => {
      if (dto.version !== undefined) {
        const versionCheck = await tx.invoice.updateMany({
          where: { id: invoiceId, tenantId, version: dto.version },
          data: { version: { increment: 1 } }
        });
        if (versionCheck.count === 0) {
          throw new ConflictError('This invoice was changed by someone else. Please reload and try again.');
        }
      } else {
        await tx.invoice.updateMany({ where: { id: invoiceId, tenantId }, data: { version: { increment: 1 } } });
      }

      const current = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

      let updateData: any = {
        notes: dto.notes,
        dueDate: dto.dueDate
      };

      if (dto.discount !== undefined && dto.discount !== Number(current.discount)) {
        const newDiscount = dto.discount;
        const totalBeforeDiscount = Number(current.subtotal) + Number(current.taxAmount);
        // totalAmount is the full billed amount (informational — includes any
        // insurance-covered portion) and moves 1:1 with discount. balance is
        // the patient's own remaining responsibility, which does NOT equal
        // totalAmount - paidAmount whenever insurance coverage applies — see
        // record-payment.use-case.ts. Re-deriving it from current.balance
        // (which already excludes that covered portion) and adjusting only
        // by the change in discount preserves that invariant instead of
        // reintroducing the covered amount as newly owed.
        const totalAmount = totalBeforeDiscount - newDiscount;
        const balance = Math.max(0, Number(current.balance) + Number(current.discount) - newDiscount);

        // Keep paymentStatus/status in sync with the recomputed balance —
        // otherwise a discount that fully waives the remaining balance would
        // still show as UNPAID/ISSUED and keep cluttering Outstanding
        // Balances despite owing nothing (same fix already applied at
        // invoice generation — see generate-invoice.use-case.ts).
        let paymentStatus = current.paymentStatus;
        let status = current.status;
        if (balance === 0) {
          paymentStatus = 'PAID';
          status = 'PAID';
        } else if (Number(current.paidAmount) > 0) {
          paymentStatus = 'PARTIALLY_PAID';
          status = 'PARTIALLY_PAID';
        } else {
          paymentStatus = 'UNPAID';
        }

        updateData = {
          ...updateData,
          discount: newDiscount,
          totalAmount,
          balance,
          paymentStatus,
          status
        };
      }

      if (Object.keys(updateData).length > 0) {
        updateData.auditLogs = {
          create: {
            tenantId,
            userId,
            action: 'UPDATED',
            notes: 'Invoice updated',
            previousValues: { discount: Number(current.discount), dueDate: current.dueDate } as any,
            newValues: updateData as any
          }
        };
      }

      return tx.invoice.update({
        where: { id: invoiceId },
        data: updateData,
        include: { items: true }
      });
    });

    return invoice;
  }
}
