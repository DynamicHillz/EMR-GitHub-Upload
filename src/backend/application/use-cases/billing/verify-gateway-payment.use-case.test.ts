/**
 * Verify Gateway Payment Use Case Tests
 *
 * Covers the same balance-corruption bug as record-payment.use-case.ts:
 * balance was recomputed as `totalAmount - paidAmount` instead of decrementing
 * the invoice's own `balance` (which already excludes any insurance-covered
 * portion). Fixed to anchor on current.balance.
 */

const mockGateway = { verifyPayment: jest.fn() };

jest.mock('../../../infrastructure/payment-gateways/payment-gateway.factory', () => ({
  PaymentGatewayFactory: {
    getConfigFromEnv: jest.fn().mockReturnValue({ publicKey: 'pk', secretKey: 'sk', callbackUrl: 'cb' }),
    getGateway: jest.fn(() => mockGateway),
  },
}));

import { VerifyGatewayPaymentUseCase } from './verify-gateway-payment.use-case';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

describe('VerifyGatewayPaymentUseCase', () => {
  let useCase: VerifyGatewayPaymentUseCase;
  let mockPrisma: any;
  let mockTx: any;

  const tenantId = 'tenant-1';
  const paymentReference = 'PAY-001';
  const invoiceId = 'invoice-1';

  const pendingPayment = {
    id: 'payment-1',
    invoiceId,
    tenantId,
    status: 'PENDING',
    amount: 2000,
    gatewayProvider: 'PAYSTACK',
    gatewayRef: 'gw-ref-1',
  };

  // Copay-covered invoice: totalAmount is the full billed amount, balance
  // already reflects only the patient's share.
  const copayInvoice = {
    id: invoiceId,
    tenantId,
    totalAmount: 10000,
    paidAmount: 0,
    balance: 2000,
    status: 'ISSUED',
  };

  const successfulVerification = {
    success: true,
    status: 'successful',
    amount: 2000,
    paidAt: new Date('2026-06-01T00:00:00.000Z'),
    cardLast4: '1234',
    cardBrand: 'visa',
    gatewayData: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn(),
      },
      invoice: {
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    mockPrisma = {
      payment: { findFirst: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    useCase = new VerifyGatewayPaymentUseCase(mockPrisma);
  });

  function setupHappyPath() {
    mockPrisma.payment.findFirst.mockResolvedValue({ ...pendingPayment, invoice: copayInvoice });
    mockGateway.verifyPayment.mockResolvedValue(successfulVerification);
    mockTx.payment.findUniqueOrThrow.mockResolvedValue({ ...pendingPayment, status: 'COMPLETED' });
    mockTx.invoice.findUniqueOrThrow.mockResolvedValue(copayInvoice);
  }

  it('credits the copay balance correctly instead of reintroducing the insurance-covered portion', async () => {
    setupHappyPath();

    await useCase.execute(paymentReference, tenantId);

    // Correct: 2000 (balance) - 2000 (payment) = 0. The bug would have
    // produced 10000 (totalAmount) - 2000 = 8000.
    const invoiceUpdateCall = mockTx.invoice.updateMany.mock.calls[0][0];
    expect(invoiceUpdateCall.data.balance).toBe(0);
    expect(invoiceUpdateCall.data.paymentStatus).toBe('PAID');
  });

  it('correctly computes a partial balance for a partial gateway payment', async () => {
    mockPrisma.payment.findFirst.mockResolvedValue({
      ...pendingPayment,
      amount: 500,
      invoice: copayInvoice,
    });
    mockGateway.verifyPayment.mockResolvedValue({ ...successfulVerification, amount: 500 });
    mockTx.invoice.findUniqueOrThrow.mockResolvedValue(copayInvoice);

    await useCase.execute(paymentReference, tenantId);

    const invoiceUpdateCall = mockTx.invoice.updateMany.mock.calls[0][0];
    expect(invoiceUpdateCall.data.balance).toBe(1500); // 2000 - 500, not 10000 - 500
    expect(invoiceUpdateCall.data.paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('returns alreadyProcessed for a payment that is no longer PENDING, without re-crediting the invoice', async () => {
    mockPrisma.payment.findFirst.mockResolvedValue({ ...pendingPayment, status: 'COMPLETED', invoice: copayInvoice });

    const result = await useCase.execute(paymentReference, tenantId);

    expect(result.alreadyProcessed).toBe(true);
    expect(mockGateway.verifyPayment).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('marks the payment FAILED and throws on an amount mismatch, without crediting the invoice', async () => {
    mockPrisma.payment.findFirst.mockResolvedValue({ ...pendingPayment, invoice: copayInvoice });
    mockGateway.verifyPayment.mockResolvedValue({ ...successfulVerification, amount: 999999 });

    await expect(useCase.execute(paymentReference, tenantId)).rejects.toThrow(ValidationError);
    expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: pendingPayment.id, status: 'PENDING' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the payment reference does not exist for the tenant', async () => {
    mockPrisma.payment.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(paymentReference, tenantId)).rejects.toThrow(NotFoundError);
  });
});
