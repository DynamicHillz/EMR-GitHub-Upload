/**
 * Update Invoice Use Case
 *
 * REQ-BILL-1: Update draft invoices
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export interface UpdateInvoiceDto {
  discount?: number;
  notes?: string;
  dueDate?: Date;
}

export class UpdateInvoiceUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(invoiceId: string, dto: UpdateInvoiceDto, tenantId: string) {
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

    // Recalculate totals if discount changed
    let updateData: any = {
      notes: dto.notes,
      dueDate: dto.dueDate
    };

    if (dto.discount !== undefined && dto.discount !== existing.discount) {
      const newDiscount = dto.discount;
      const totalBeforeDiscount = existing.subtotal + existing.taxAmount;
      const totalAmount = totalBeforeDiscount - newDiscount;
      const balance = totalAmount - existing.paidAmount;

      updateData = {
        ...updateData,
        discount: newDiscount,
        totalAmount,
        balance
      };
    }

    const invoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData
    });

    return {
      ...invoice,
      lineItems: JSON.parse(invoice.lineItems)
    };
  }
}
