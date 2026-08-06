/**
 * Approve Refund Use Case Tests
 */

import { ApproveRefundUseCase } from './approve-refund.use-case';
import { NotFoundError, ValidationError, ConflictError } from '../../../shared/errors/AppError';

describe('ApproveRefundUseCase', () => {
  let useCase: ApproveRefundUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const refundId = 'refund-1';
  const approvedById = 'admin-1';

  const pendingRefund = { id: refundId, tenantId, status: 'PENDING', invoice: {} };

  beforeEach(() => {
    mockPrisma = {
      refund: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };

    useCase = new ApproveRefundUseCase(mockPrisma);
  });

  it('throws NotFoundError when the refund does not exist for this tenant', async () => {
    mockPrisma.refund.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(refundId, tenantId, approvedById)).rejects.toThrow(NotFoundError);
    expect(mockPrisma.refund.updateMany).not.toHaveBeenCalled();
  });

  it('throws ValidationError when the refund is not PENDING', async () => {
    mockPrisma.refund.findFirst.mockResolvedValue({ ...pendingRefund, status: 'APPROVED' });

    await expect(useCase.execute(refundId, tenantId, approvedById)).rejects.toThrow(ValidationError);
    expect(mockPrisma.refund.updateMany).not.toHaveBeenCalled();
  });

  it('approves a PENDING refund via a guarded updateMany', async () => {
    mockPrisma.refund.findFirst.mockResolvedValue(pendingRefund);
    mockPrisma.refund.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.refund.findUniqueOrThrow.mockResolvedValue({ ...pendingRefund, status: 'APPROVED', approvedById });

    const result = await useCase.execute(refundId, tenantId, approvedById);

    expect(mockPrisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: refundId, tenantId, status: 'PENDING' },
      data: expect.objectContaining({ status: 'APPROVED', approvedById }),
    });
    expect(result.status).toBe('APPROVED');
  });

  it('throws ConflictError when another request already approved/rejected it first (lost the race)', async () => {
    mockPrisma.refund.findFirst.mockResolvedValue(pendingRefund);
    mockPrisma.refund.updateMany.mockResolvedValue({ count: 0 });

    await expect(useCase.execute(refundId, tenantId, approvedById)).rejects.toThrow(ConflictError);
  });
});
