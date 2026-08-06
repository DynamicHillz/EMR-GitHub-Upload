/**
 * Cancel Invoice Use Case Tests
 *
 * Covers two fixes:
 * 1. The cancellation guard now checks paidAmount, not paymentStatus — a
 *    fully HMO/exemption-covered invoice reads paymentStatus 'PAID'
 *    immediately at generation (see generate-invoice.use-case.ts) even
 *    though the patient paid nothing, and the old guard wrongly blocked
 *    cancelling a mis-billed HMO invoice with no real payment to refund.
 * 2. An auto-created InsuranceClaim tied to the invoice is cancelled along
 *    with it — unless the HMO already paid it, in which case cancellation
 *    is blocked instead of silently orphaning settled money.
 */

import { CancelInvoiceUseCase } from './cancel-invoice.use-case';
import { ValidationError } from '../../../shared/errors/AppError';

describe('CancelInvoiceUseCase', () => {
  let useCase: CancelInvoiceUseCase;
  let mockPrisma: any;
  let mockTx: any;

  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const invoiceId = 'invoice-1';

  // Fully HMO-covered invoice: paymentStatus/status are 'PAID' from
  // generation (balance 0), but paidAmount is 0 — the patient never paid
  // anything; the HMO did, via a separate InsuranceClaim.
  const hmoInvoice = {
    id: invoiceId,
    tenantId,
    status: 'PAID',
    paymentStatus: 'PAID',
    paidAmount: 0,
    balance: 0,
    notes: null,
  };

  const draftClaim = { id: 'claim-1', invoiceId, status: 'DRAFT' };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({ ...hmoInvoice, items: [] }),
        update: jest.fn(),
      },
      insuranceClaim: { update: jest.fn().mockResolvedValue({}) },
      consultation: { updateMany: jest.fn() },
      labOrder: { updateMany: jest.fn() },
      prescription: { updateMany: jest.fn() },
      consumableUsage: { updateMany: jest.fn() },
      admission: { updateMany: jest.fn() },
      transfusionChart: { updateMany: jest.fn() },
      operationNote: { updateMany: jest.fn() },
      laborRecord: { updateMany: jest.fn() },
    };

    mockPrisma = {
      invoice: { findFirst: jest.fn() },
      insuranceClaim: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    mockTx.invoice.update.mockImplementation((args: any) =>
      Promise.resolve({ ...hmoInvoice, ...args.data, items: [] })
    );

    useCase = new CancelInvoiceUseCase(mockPrisma);
  });

  it('allows cancelling a fully HMO-covered invoice with paymentStatus PAID but no real patient payment', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(hmoInvoice);

    const result = await useCase.execute(invoiceId, tenantId, userId, 'Wrong patient billed');

    expect(result.status).toBe('CANCELLED');
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('cancels the associated DRAFT insurance claim along with the invoice', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(hmoInvoice);
    mockPrisma.insuranceClaim.findUnique.mockResolvedValue(draftClaim);

    await useCase.execute(invoiceId, tenantId, userId);

    expect(mockTx.insuranceClaim.update).toHaveBeenCalledWith({
      where: { id: draftClaim.id },
      data: { status: 'CANCELLED' },
    });
  });

  it('blocks cancellation when the insurance claim has already been PAID', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(hmoInvoice);
    mockPrisma.insuranceClaim.findUnique.mockResolvedValue({ ...draftClaim, status: 'PAID' });

    await expect(useCase.execute(invoiceId, tenantId, userId)).rejects.toThrow(ValidationError);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('still blocks cancellation when the patient has actually paid something', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({ ...hmoInvoice, paidAmount: 500 });

    await expect(useCase.execute(invoiceId, tenantId, userId)).rejects.toThrow(
      'Cannot cancel an invoice with payments recorded against it. Request a refund instead.'
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects cancelling an already-cancelled invoice', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({ ...hmoInvoice, status: 'CANCELLED' });

    await expect(useCase.execute(invoiceId, tenantId, userId)).rejects.toThrow('Invoice is already cancelled');
  });

  it('unbills consumable usage, admissions, transfusions, operation notes, and labor records, not just consultations/labs/prescriptions', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(hmoInvoice);
    mockTx.invoice.findUnique.mockResolvedValue({
      ...hmoInvoice,
      items: [
        { consultationId: 'con-1' },
        { labOrderId: 'lab-1' },
        { prescriptionId: 'rx-1' },
        { consumableUsageId: 'cu-1' },
        { admissionId: 'adm-1' },
        { transfusionChartId: 'tx-1' },
        { operationNoteId: 'op-1' },
        { laborRecordId: 'labor-1' },
      ],
    });

    await useCase.execute(invoiceId, tenantId, userId);

    expect(mockTx.consultation.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['con-1'] } },
      data: { billingStatus: 'UNBILLED' },
    });
    expect(mockTx.labOrder.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['lab-1'] } },
      data: { billingStatus: 'UNBILLED' },
    });
    expect(mockTx.prescription.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['rx-1'] } },
      data: { billingStatus: 'UNBILLED' },
    });
    expect(mockTx.consumableUsage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['cu-1'] } },
      data: { billingStatus: 'UNBILLED' },
    });
    expect(mockTx.admission.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['adm-1'] } },
      data: { billingStatus: 'UNBILLED' },
    });
    expect(mockTx.transfusionChart.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['tx-1'] } },
      data: { billingStatus: 'UNBILLED' },
    });
    expect(mockTx.operationNote.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['op-1'] } },
      data: { billingStatus: 'UNBILLED' },
    });
    expect(mockTx.laborRecord.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['labor-1'] } },
      data: { billingStatus: 'UNBILLED' },
    });
  });
});
