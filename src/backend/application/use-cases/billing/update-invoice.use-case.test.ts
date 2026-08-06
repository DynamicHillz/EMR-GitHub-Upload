/**
 * Update Invoice Use Case Tests
 *
 * Covers the same balance-corruption bug as record-payment.use-case.ts: a
 * discount edit recomputed balance as `totalAmount - paidAmount`, silently
 * reintroducing any insurance-covered portion as newly owed by the patient.
 * Fixed to adjust the invoice's own `balance` by the *change* in discount.
 * Also covers keeping paymentStatus/status in sync when a discount edit
 * zeroes out the remaining balance.
 */

import { UpdateInvoiceUseCase } from './update-invoice.use-case';
import { ValidationError, ConflictError } from '../../../shared/errors/AppError';

describe('UpdateInvoiceUseCase', () => {
  let useCase: UpdateInvoiceUseCase;
  let mockPrisma: any;
  let mockTx: any;

  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const invoiceId = 'invoice-1';

  // Copay-covered invoice: subtotal+tax = 10000, but only the patient's 2000
  // out-of-pocket share is reflected in balance — 8000 is insurance-covered
  // and was carved out at generation, never billed to the patient.
  const copayInvoice = {
    id: invoiceId,
    tenantId,
    status: 'ISSUED',
    paymentStatus: 'UNPAID',
    subtotal: 9000,
    taxAmount: 1000,
    discount: 0,
    totalAmount: 10000,
    paidAmount: 0,
    balance: 2000,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      invoice: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
    };

    mockPrisma = {
      invoice: { findFirst: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    useCase = new UpdateInvoiceUseCase(mockPrisma);
  });

  function setupHappyPath(invoice: any) {
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
    mockTx.invoice.findUniqueOrThrow.mockResolvedValue(invoice);
    mockTx.invoice.update.mockImplementation((args: any) => Promise.resolve({ ...invoice, ...args.data }));
  }

  it('applies a small discount to the patient balance without reintroducing the insurance-covered portion', async () => {
    setupHappyPath(copayInvoice);

    await useCase.execute(invoiceId, { discount: 200 }, tenantId, userId);

    // Correct: 2000 (balance) + 0 (old discount) - 200 (new discount) = 1800.
    // The old formula would have produced (10000 - 200) - 0 = 9800.
    const updateCall = mockTx.invoice.update.mock.calls[0][0];
    expect(updateCall.data.balance).toBe(1800);
    expect(updateCall.data.totalAmount).toBe(9800);
    expect(updateCall.data.paymentStatus).toBe('UNPAID');
  });

  it('flips to PAID when a discount fully waives the remaining copay balance', async () => {
    setupHappyPath(copayInvoice);

    await useCase.execute(invoiceId, { discount: 2000 }, tenantId, userId);

    const updateCall = mockTx.invoice.update.mock.calls[0][0];
    expect(updateCall.data.balance).toBe(0);
    expect(updateCall.data.paymentStatus).toBe('PAID');
    expect(updateCall.data.status).toBe('PAID');
  });

  it('clamps balance at 0 rather than going negative when the discount overshoots', async () => {
    setupHappyPath(copayInvoice);

    await useCase.execute(invoiceId, { discount: 5000 }, tenantId, userId);

    const updateCall = mockTx.invoice.update.mock.calls[0][0];
    expect(updateCall.data.balance).toBe(0);
  });

  it('correctly reduces an already-partially-discounted invoice when the discount changes again', async () => {
    const alreadyDiscounted = { ...copayInvoice, discount: 200, totalAmount: 9800, balance: 1800 };
    setupHappyPath(alreadyDiscounted);

    await useCase.execute(invoiceId, { discount: 500 }, tenantId, userId);

    // 1800 (balance) + 200 (old discount) - 500 (new discount) = 1500.
    const updateCall = mockTx.invoice.update.mock.calls[0][0];
    expect(updateCall.data.balance).toBe(1500);
  });

  it('rejects a discount outside 0..subtotal+tax', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(copayInvoice);

    await expect(useCase.execute(invoiceId, { discount: -1 }, tenantId, userId)).rejects.toThrow(ValidationError);
    await expect(useCase.execute(invoiceId, { discount: 10001 }, tenantId, userId)).rejects.toThrow(ValidationError);
  });

  it('rejects updates to an invoice that is not DRAFT or ISSUED', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({ ...copayInvoice, status: 'PAID' });

    await expect(useCase.execute(invoiceId, { discount: 100 }, tenantId, userId)).rejects.toThrow(ValidationError);
  });

  it('throws ConflictError on a stale version', async () => {
    setupHappyPath(copayInvoice);
    mockTx.invoice.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      useCase.execute(invoiceId, { discount: 100, version: 3 }, tenantId, userId)
    ).rejects.toThrow(ConflictError);
  });
});
