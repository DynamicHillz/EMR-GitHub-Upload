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
      // @ts-ignore - Temporary fix for schema alignment
      if (dto.amount > payment.amount) {
        throw new ValidationError(`Refund amount (₦${dto.amount}) cannot exceed payment amount (₦${payment.amount})`);
      }
    }

    // Validate refund amount — isNaN check first, since `NaN <= 0` is false
    // in JS and a malformed amount would otherwise pass straight through.
    if (isNaN(dto.amount) || dto.amount <= 0) {
      throw new ValidationError('Refund amount must be a valid positive number');
    }

    // invoice.paidAmount only moves when a refund is actually *processed*
    // (process-refund.use-case.ts), not when it's merely requested/approved —
    // so without this, two refund requests submitted before either is
    // processed can each individually look valid against the same paidAmount.
    const outstandingRefunds = await this.prisma.refund.aggregate({
      where: { invoiceId: dto.invoiceId, tenantId, status: { in: ['PENDING', 'APPROVED'] } },
      _sum: { amount: true }
    });
    const alreadyRequestedOrApproved = Number(outstandingRefunds._sum.amount || 0);
    const availableToRefund = Number(invoice.paidAmount) - alreadyRequestedOrApproved;

    if (dto.amount > availableToRefund) {
      throw new ValidationError(
        `Refund amount (₦${dto.amount}) exceeds what remains available to refund on this invoice (₦${availableToRefund}) — other refund requests are already pending or approved.`
      );
    }

    // Generate refund number
    const refundNumber = await this.generateRefundNumber(tenantId);

    // Refund requests at or below the tenant's configured auto-approve threshold
    // skip manual approval and go straight to APPROVED — still requires the
    // separate process-refund step to actually complete.
    const fraudSettings = await this.prisma.fraudPreventionSettings.findUnique({
      where: { tenantId }
    });
    const autoApprove =
      fraudSettings?.refundAutoApproveThreshold != null &&
      dto.amount <= fraudSettings.refundAutoApproveThreshold;

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
        status: autoApprove ? 'APPROVED' : 'PENDING',
        ...(autoApprove ? { approvedAt: new Date() } : {}),
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
