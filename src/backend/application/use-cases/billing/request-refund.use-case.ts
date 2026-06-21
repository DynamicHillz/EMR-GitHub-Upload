/**
 * Request Refund Use Case
 *
 * REQ-BILL-5: Request refund with admin approval workflow
 */

import { PrismaClient } from '@prisma/client';
import type { PaymentMethod } from '../../../shared/types/prisma-enums.ts';;
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export interface RequestRefundDto {
  invoiceId: string;
  paymentId?: string;
  amount: number;
  reason: string;
  refundMethod: PaymentMethod;
  notes?: string;
}

export class RequestRefundUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: RequestRefundDto, tenantId: string, requestedById: string) {
    // Validate invoice
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: dto.invoiceId,
        tenantId
      },
      include: {
        payments: true
      }
    });

    if (!invoice) {
      throw new NotFoundError('Invoice', dto.invoiceId);
    }

    // Validate payment if specified
    if (dto.paymentId) {
      const payment = invoice.payments.find(p => p.id === dto.paymentId);
      if (!payment) {
        throw new NotFoundError('Payment', dto.paymentId);
      }

      // Cannot refund more than payment amount
      if (dto.amount > payment.amount) {
        throw new ValidationError(`Refund amount (₦${dto.amount}) cannot exceed payment amount (₦${payment.amount})`);
      }
    }

    // Validate refund amount
    if (dto.amount <= 0) {
      throw new ValidationError('Refund amount must be greater than zero');
    }

    if (dto.amount > invoice.paidAmount) {
      throw new ValidationError(`Refund amount (₦${dto.amount}) exceeds paid amount (₦${invoice.paidAmount})`);
    }

    // Generate refund number
    const refundNumber = await this.generateRefundNumber(tenantId);

    // Create refund request
    const refund = await this.prisma.refund.create({
      data: {
        tenantId,
        invoiceId: dto.invoiceId,
        paymentId: dto.paymentId,
        patientId: invoice.patientId,
        refundNumber,
        amount: dto.amount,
        reason: dto.reason,
        refundMethod: dto.refundMethod,
        requestedById,
        requestedAt: new Date(),
        status: 'PENDING',
        notes: dto.notes
      }
    });

    return refund;
  }

  private async generateRefundNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `REF-${year}${month}${day}`;

    // Count refunds created today
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await this.prisma.refund.count({
      where: {
        tenantId,
        requestedAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `${datePrefix}-${sequence}`;
  }
}
