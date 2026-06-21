/**
 * Reject Refund Use Case
 *
 * REQ-BILL-5: Admin rejection of refund
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export class RejectRefundUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(refundId: string, rejectionReason: string, tenantId: string, rejectedById: string) {
    // Validate refund exists
    const refund = await this.prisma.refund.findFirst({
      where: {
        id: refundId,
        tenantId
      }
    });

    if (!refund) {
      throw new NotFoundError('Refund', refundId);
    }

    if (refund.status !== 'PENDING') {
      throw new ValidationError(`Cannot reject refund with status: ${refund.status}`);
    }

    // Update refund status
    const updatedRefund = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'REJECTED',
        rejectedById,
        rejectedAt: new Date(),
        rejectionReason
      }
    });

    return updatedRefund;
  }
}
