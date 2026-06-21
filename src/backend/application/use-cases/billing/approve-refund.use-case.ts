/**
 * Approve Refund Use Case
 *
 * REQ-BILL-5: Admin approval for refund
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export class ApproveRefundUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(refundId: string, tenantId: string, approvedById: string) {
    // Validate refund exists
    const refund = await this.prisma.refund.findFirst({
      where: {
        id: refundId,
        tenantId
      },
      include: {
        invoice: true
      }
    });

    if (!refund) {
      throw new NotFoundError('Refund', refundId);
    }

    if (refund.status !== 'PENDING') {
      throw new ValidationError(`Cannot approve refund with status: ${refund.status}`);
    }

    // Update refund status
    const updatedRefund = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'APPROVED',
        approvedById,
        approvedAt: new Date()
      }
    });

    return updatedRefund;
  }
}
