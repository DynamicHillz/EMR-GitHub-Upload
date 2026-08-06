/**
 * Reject Refund Use Case
 *
 * REQ-BILL-5: Admin rejection of refund
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../../../shared/errors/AppError';

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

    // Guarded on status, same as process-refund.use-case.ts — two admins
    // acting on the same refund at once can otherwise both pass the check
    // above and both write, one silently clobbering the other's result.
    const updateResult = await this.prisma.refund.updateMany({
      where: { id: refundId, tenantId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        rejectedById,
        rejectedAt: new Date(),
        rejectionReason
      }
    });

    if (updateResult.count === 0) {
      throw new ConflictError('This refund was already approved or rejected by another request.');
    }

    return this.prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
  }
}
