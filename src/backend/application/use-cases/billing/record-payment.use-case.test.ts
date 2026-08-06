/**
 * Record Payment Use Case Tests
 *
 * Covers a real balance-corruption bug: balance was recomputed as
 * `totalAmount - paidAmount`, where totalAmount is the FULL billed amount
 * (including any insurance-covered portion the patient never owed). For any
 * partially-insurance-covered invoice (exemption discount, or legacy
 * PatientInsurance copay), this silently reintroduced the covered amount as
 * still outstanding the moment a payment was recorded. Fixed to decrement
 * the invoice's own `balance` directly, which already excludes that portion.
 */

import { RecordPaymentUseCase } from './record-payment.use-case';
import { ValidationError, ConflictError } from '../../../shared/errors/AppError';

describe('RecordPaymentUseCase', () => {
  let useCase: RecordPaymentUseCase;
  let mockPrisma: any;
  let mockTx: any;

  const tenantId = 'tenant-1';
  const processedById = 'user-1';
  const invoiceId = 'invoice-1';

  const dto = {
    invoiceId,
    amount: 2000,
    paymentMethod: 'CASH' as const,
    cashReceivedByName: 'Jane Doe',
  };

  // A copay-covered invoice: totalAmount is the FULL billed amount (10000),
  // but balance (2000) already reflects only the patient's 20% copay share —
  // insuranceCoverage of 8000 was carved out at generation and is never the
  // patient's responsibility.
  const copayInvoice = {
    id: invoiceId,
    tenantId,
    patientId: 'patient-1',
    status: 'ISSUED',
    totalAmount: 10000,
    paidAmount: 0,
    balance: 2000,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      invoice: {
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: { create: jest.fn() },
      invoiceAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    mockPrisma = {
      invoice: { findFirst: jest.fn() },
      fraudPreventionSettings: { findUnique: jest.fn().mockResolvedValue(null) }, // no fraud rules configured — bypass checks
      paymentAuditLog: { create: jest.fn().mockResolvedValue({}) },
      payment: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    useCase = new RecordPaymentUseCase(mockPrisma);
  });

  function setupHappyPath(invoice: any) {
    mockPrisma.invoice.findFirst.mockResolvedValue({ ...invoice, patient: { id: invoice.patientId, firstName: 'A', lastName: 'B' } });
    mockTx.invoice.findUniqueOrThrow.mockResolvedValue(invoice);
    mockTx.payment.create.mockResolvedValue({ id: 'payment-1', amount: dto.amount });
  }

  it('pays off the patient copay balance in full without reintroducing the insurance-covered portion', async () => {
    setupHappyPath(copayInvoice);

    const result = await useCase.execute(dto, tenantId, processedById);

    // Correct: 2000 (balance) - 2000 (payment) = 0. The buggy formula would
    // have produced 10000 (totalAmount) - 2000 (newPaidAmount) = 8000.
    expect(result.invoice.balance).toBe(0);
    expect(result.invoice.paymentStatus).toBe('PAID');

    const updateCall = mockTx.invoice.updateMany.mock.calls[0][0];
    expect(updateCall.data.balance).toBe(0);
    expect(updateCall.data.paymentStatus).toBe('PAID');
    expect(updateCall.data.status).toBe('PAID');
  });

  it('correctly tracks a partial payment against a copay balance', async () => {
    setupHappyPath(copayInvoice);

    const result = await useCase.execute({ ...dto, amount: 500 }, tenantId, processedById);

    // 2000 (balance) - 500 (payment) = 1500, not 10000 - 500 = 9500.
    expect(result.invoice.balance).toBe(1500);
    expect(result.invoice.paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('produces the same correct result for a plain private-pay invoice with no coverage', async () => {
    const privateInvoice = { ...copayInvoice, totalAmount: 2000, balance: 2000 };
    setupHappyPath(privateInvoice);

    const result = await useCase.execute(dto, tenantId, processedById);

    expect(result.invoice.balance).toBe(0);
    expect(result.invoice.paymentStatus).toBe('PAID');
  });

  it('rejects a payment amount greater than the invoice balance', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({ ...copayInvoice, patient: { id: 'patient-1', firstName: 'A', lastName: 'B' } });

    await expect(
      useCase.execute({ ...dto, amount: 5000 }, tenantId, processedById)
    ).rejects.toThrow(ValidationError);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws a ConflictError when a concurrent payment already changed paidAmount', async () => {
    setupHappyPath(copayInvoice);
    mockTx.invoice.updateMany.mockResolvedValue({ count: 0 });

    await expect(useCase.execute(dto, tenantId, processedById)).rejects.toThrow(ConflictError);
  });

  it('rejects a cash payment with no cashReceivedByName', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({ ...copayInvoice, patient: { id: 'patient-1', firstName: 'A', lastName: 'B' } });

    await expect(
      useCase.execute({ ...dto, cashReceivedByName: undefined }, tenantId, processedById)
    ).rejects.toThrow('Cash payments require the name of the staff member who received the cash.');
  });
});
