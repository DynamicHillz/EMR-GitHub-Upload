/**
 * Process Refund Use Case Tests
 *
 * Covers the same balance-corruption bug as record-payment.use-case.ts:
 * balance was recomputed as `totalAmount - paidAmount` instead of adjusting
 * the invoice's own `balance` by the refunded amount. On a partially
 * insurance-covered invoice, totalAmount includes the covered portion the
 * patient never owed, so the old formula overstated the post-refund balance.
 */

import { ProcessRefundUseCase } from './process-refund.use-case';
import { ValidationError, ConflictError } from '../../../shared/errors/AppError';

describe('ProcessRefundUseCase', () => {
  let useCase: ProcessRefundUseCase;
  let mockPrisma: any;
  let mockTx: any;

  const tenantId = 'tenant-1';
  const refundId = 'refund-1';
  const invoiceId = 'invoice-1';

  // Copay-covered invoice, fully paid by the patient (their 2000 share):
  // totalAmount (10000) includes 8000 of insurance coverage that was never
  // the patient's responsibility and never went through Payment/paidAmount.
  const paidCopayInvoice = {
    id: invoiceId,
    tenantId,
    totalAmount: 10000,
    paidAmount: 2000,
    balance: 0,
    status: 'PAID',
    paymentStatus: 'PAID',
  };

  const approvedRefund = {
    id: refundId,
    tenantId,
    invoiceId,
    paymentId: 'payment-1',
    amount: 500,
    status: 'APPROVED',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      refund: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn(),
      },
      invoice: {
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: { update: jest.fn().mockResolvedValue({}) },
    };

    mockPrisma = {
      refund: { findFirst: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    useCase = new ProcessRefundUseCase(mockPrisma);
  });

  function setupHappyPath(refund: any, invoice: any) {
    mockPrisma.refund.findFirst.mockResolvedValue({ ...refund, invoice, payment: { id: refund.paymentId } });
    mockTx.invoice.findUniqueOrThrow.mockResolvedValue(invoice);
    mockTx.refund.findUniqueOrThrow.mockResolvedValue({ ...refund, status: 'COMPLETED' });
  }

  it('increases balance by the refunded amount rather than reintroducing the insurance-covered portion', async () => {
    setupHappyPath(approvedRefund, paidCopayInvoice);
    mockTx.invoice.findUniqueOrThrow
      .mockResolvedValueOnce(paidCopayInvoice) // read inside the transaction
      .mockResolvedValueOnce({ ...paidCopayInvoice, paidAmount: 1500, balance: 500 }); // final re-fetch

    const result = await useCase.execute(refundId, {}, tenantId);

    // Correct: 0 (balance) + 500 (refund) = 500, not 10000 (totalAmount) - 1500 (newPaidAmount) = 8500.
    const invoiceUpdateCall = mockTx.invoice.updateMany.mock.calls[0][0];
    expect(invoiceUpdateCall.data.balance).toBe(500);
    expect(invoiceUpdateCall.data.paidAmount).toBe(1500);
    expect(invoiceUpdateCall.data.paymentStatus).toBe('PARTIALLY_PAID');
    expect(result.invoice.balance).toBe(500);
  });

  it('marks the invoice REFUNDED when the full paid amount is refunded', async () => {
    const fullRefund = { ...approvedRefund, amount: 2000 };
    setupHappyPath(fullRefund, paidCopayInvoice);
    mockTx.invoice.findUniqueOrThrow
      .mockResolvedValueOnce(paidCopayInvoice)
      .mockResolvedValueOnce({ ...paidCopayInvoice, paidAmount: 0, balance: 2000, status: 'REFUNDED' });

    await useCase.execute(refundId, {}, tenantId);

    const invoiceUpdateCall = mockTx.invoice.updateMany.mock.calls[0][0];
    expect(invoiceUpdateCall.data.paidAmount).toBe(0);
    expect(invoiceUpdateCall.data.balance).toBe(2000); // 0 + 2000, not 10000 - 0
    expect(invoiceUpdateCall.data.paymentStatus).toBe('REFUNDED');
    expect(invoiceUpdateCall.data.status).toBe('REFUNDED');
  });

  it('throws when the refund is not APPROVED', async () => {
    mockPrisma.refund.findFirst.mockResolvedValue({ ...approvedRefund, status: 'PENDING', invoice: paidCopayInvoice });

    await expect(useCase.execute(refundId, {}, tenantId)).rejects.toThrow(ValidationError);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects when the refund would exceed what was actually paid', async () => {
    setupHappyPath(approvedRefund, { ...paidCopayInvoice, paidAmount: 300 });
    mockTx.invoice.findUniqueOrThrow.mockResolvedValue({ ...paidCopayInvoice, paidAmount: 300 });

    await expect(useCase.execute(refundId, {}, tenantId)).rejects.toThrow(ValidationError);
  });

  it('throws a ConflictError when this refund was already processed concurrently', async () => {
    mockPrisma.refund.findFirst.mockResolvedValue({ ...approvedRefund, invoice: paidCopayInvoice });
    mockTx.refund.updateMany.mockResolvedValue({ count: 0 });

    await expect(useCase.execute(refundId, {}, tenantId)).rejects.toThrow(ConflictError);
  });
});
