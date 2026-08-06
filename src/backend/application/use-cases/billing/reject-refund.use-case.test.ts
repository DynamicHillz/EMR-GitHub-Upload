/**
 * Reject Refund Use Case Tests
 */

import { RejectRefundUseCase } from './reject-refund.use-case';
import { NotFoundError, ValidationError, ConflictError } from '../../../shared/errors/AppError';

describe('RejectRefundUseCase', () => {
  let useCase: RejectRefundUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const refundId = 'refund-1';
  const rejectedById = 'admin-1';
  const reason = 'Insufficient documentation';

  const pendingRefund = { id: refundId, tenantId, status: 'PENDING' };

  beforeEach(() => {
    mockPrisma = {
      refund: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };

    useCase = new RejectRefundUseCase(mockPrisma);
  });

  it('throws NotFoundError when the refund does not exist for this tenant', async () => {
    mockPrisma.refund.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(refundId, reason, tenantId, rejectedById)).rejects.toThrow(NotFoundError);
    expect(mockPrisma.refund.updateMany).not.toHaveBeenCalled();
  });

  it('throws ValidationError when the refund is not PENDING', async () => {
    mockPrisma.refund.findFirst.mockResolvedValue({ ...pendingRefund, status: 'REJECTED' });

    await expect(useCase.execute(refundId, reason, tenantId, rejectedById)).rejects.toThrow(ValidationError);
    expect(mockPrisma.refund.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a PENDING refund via a guarded updateMany', async () => {
    mockPrisma.refund.findFirst.mockResolvedValue(pendingRefund);
    mockPrisma.refund.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.refund.findUniqueOrThrow.mockResolvedValue({ ...pendingRefund, status: 'REJECTED', rejectedById, rejectionReason: reason });

    const result = await useCase.execute(refundId, reason, tenantId, rejectedById);

    expect(mockPrisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: refundId, tenantId, status: 'PENDING' },
      data: expect.objectContaining({ status: 'REJECTED', rejectedById, rejectionReason: reason }),
    });
    expect(result.status).toBe('REJECTED');
  });

  it('throws ConflictError when another request already approved/rejected it first (lost the race)', async () => {
    mockPrisma.refund.findFirst.mockResolvedValue(pendingRefund);
    mockPrisma.refund.updateMany.mockResolvedValue({ count: 0 });

    await expect(useCase.execute(refundId, reason, tenantId, rejectedById)).rejects.toThrow(ConflictError);
  });
});
