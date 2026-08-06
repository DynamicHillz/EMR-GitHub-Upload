/**
 * Generate Invoice Use Case Tests
 *
 * Covers the 3-tier coverage precedence (HMO full coverage > exemption >
 * legacy PatientInsurance copay), the claim auto-creation referencing the
 * right provider for whichever tier applied, and the zero-balance
 * paymentStatus/status fix — a real bug this change would otherwise have
 * triggered for the first time (the insurance branch had never actually
 * fired before, since no PatientInsurance enrollments existed).
 */

import { GenerateInvoiceUseCase } from './generate-invoice.use-case';
import { ValidationError } from '../../../shared/errors/AppError';

describe('GenerateInvoiceUseCase', () => {
  let useCase: GenerateInvoiceUseCase;
  let mockPrisma: any;
  let mockTx: any;

  const tenantId = 'tenant-1';
  const issuedById = 'user-1';
  const patientId = 'patient-1';

  const dto = {
    patientId,
    consultationIds: ['consult-1'],
  };

  const consultation = { id: 'consult-1', tenantId, patientId, status: 'COMPLETED', isDeleted: false };

  function agedDateOfBirth(years: number): Date {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    return d;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      consultation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      invoice: { create: jest.fn() },
      insuranceClaim: { create: jest.fn().mockResolvedValue({}) },
    };

    mockPrisma = {
      patient: { findFirst: jest.fn() },
      serviceCatalog: { findMany: jest.fn().mockResolvedValue([]) },
      insuranceProvider: { findFirst: jest.fn().mockResolvedValue(null) },
      patientInsurance: { findFirst: jest.fn().mockResolvedValue(null) },
      exemptionPolicy: { findMany: jest.fn().mockResolvedValue([]) },
      ancPregnancy: { findFirst: jest.fn().mockResolvedValue(null) },
      consultation: { findMany: jest.fn().mockResolvedValue([consultation]) },
      invoice: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    mockTx.invoice.create.mockResolvedValue({ id: 'invoice-1' });

    useCase = new GenerateInvoiceUseCase(mockPrisma);
  });

  it('gives an HMO-covered patient full coverage even when an exemption policy would also apply', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: patientId,
      tenantId,
      dateOfBirth: agedDateOfBirth(70), // matches the '>65' exemption below
      patientType: 'HMO',
      hmoProviderId: 'hmo-provider-1',
    });
    mockPrisma.insuranceProvider.findFirst.mockResolvedValue({
      id: 'hmo-provider-1',
      tenantId,
      isActive: true,
    });
    mockPrisma.exemptionPolicy.findMany.mockResolvedValue([
      { id: 'ex-1', criteriaType: 'AGE', criteriaValue: '>65', discountPercentage: 50 },
    ]);

    await useCase.execute(dto, tenantId, issuedById);

    const invoiceData = mockTx.invoice.create.mock.calls[0][0].data;
    expect(invoiceData.balance).toBe(0);
    expect(invoiceData.paymentStatus).toBe('PAID');
    expect(invoiceData.status).toBe('PAID');
    expect(invoiceData.items.create[0].insuranceCoverage).toBe(invoiceData.subtotal);
    expect(invoiceData.items.create[0].patientOutOfPocket).toBe(0);

    // Claim goes to the HMO provider, not any exemption-related record.
    expect(mockTx.insuranceClaim.create).toHaveBeenCalledWith({
      data: {
        tenantId,
        invoiceId: 'invoice-1',
        insuranceId: 'hmo-provider-1',
        amountClaimed: invoiceData.subtotal,
        status: 'DRAFT',
      },
    });
  });

  it('does not treat the patient as HMO-covered when the linked provider is missing/inactive, falling through to exemption instead', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: patientId,
      tenantId,
      dateOfBirth: agedDateOfBirth(70),
      patientType: 'HMO',
      hmoProviderId: 'hmo-provider-1',
    });
    mockPrisma.insuranceProvider.findFirst.mockResolvedValue(null); // provider not found/inactive
    mockPrisma.exemptionPolicy.findMany.mockResolvedValue([
      { id: 'ex-1', criteriaType: 'AGE', criteriaValue: '>65', discountPercentage: 50 },
    ]);

    await useCase.execute(dto, tenantId, issuedById);

    const invoiceData = mockTx.invoice.create.mock.calls[0][0].data;
    const item = invoiceData.items.create[0];
    expect(item.insuranceCoverage).toBeCloseTo(item.subtotal * 0.5);
    expect(item.patientOutOfPocket).toBeCloseTo(item.subtotal * 0.5);
    expect(invoiceData.balance).toBeGreaterThan(0);
    expect(invoiceData.paymentStatus).toBe('UNPAID');
    expect(invoiceData.status).toBe('ISSUED');
  });

  it('falls back to the legacy PatientInsurance copay for a non-HMO patient with an active enrollment', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: patientId,
      tenantId,
      dateOfBirth: agedDateOfBirth(30),
      patientType: 'PRIVATE',
      hmoProviderId: null,
    });
    mockPrisma.patientInsurance.findFirst.mockResolvedValue({
      id: 'pi-1',
      providerId: 'legacy-provider-1',
      copayPercentage: 20,
    });

    await useCase.execute(dto, tenantId, issuedById);

    // hmoProviderId is null, so the HMO-provider lookup is never even attempted.
    expect(mockPrisma.insuranceProvider.findFirst).not.toHaveBeenCalled();

    const invoiceData = mockTx.invoice.create.mock.calls[0][0].data;
    const item = invoiceData.items.create[0];
    expect(item.patientOutOfPocket).toBeCloseTo(item.subtotal * 0.2);
    expect(item.insuranceCoverage).toBeCloseTo(item.subtotal * 0.8);
    expect(invoiceData.balance).toBeGreaterThan(0);
    expect(invoiceData.paymentStatus).toBe('UNPAID');

    expect(mockTx.insuranceClaim.create).toHaveBeenCalledWith({
      data: {
        tenantId,
        invoiceId: 'invoice-1',
        insuranceId: 'legacy-provider-1',
        amountClaimed: item.insuranceCoverage,
        status: 'DRAFT',
      },
    });
  });

  it('charges the full amount to the patient and creates no claim when there is no HMO, exemption, or legacy coverage', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: patientId,
      tenantId,
      dateOfBirth: agedDateOfBirth(30),
      patientType: 'PRIVATE',
      hmoProviderId: null,
    });

    await useCase.execute(dto, tenantId, issuedById);

    const invoiceData = mockTx.invoice.create.mock.calls[0][0].data;
    const item = invoiceData.items.create[0];
    expect(item.patientOutOfPocket).toBe(item.subtotal);
    expect(item.insuranceCoverage).toBe(0);
    expect(invoiceData.balance).toBe(item.subtotal);
    expect(invoiceData.paymentStatus).toBe('UNPAID');
    expect(invoiceData.status).toBe('ISSUED');
    expect(mockTx.insuranceClaim.create).not.toHaveBeenCalled();
  });

  it('throws when the patient does not exist for the tenant', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(dto, tenantId, issuedById)).rejects.toThrow('Patient');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws ValidationError when no billable services are found', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: patientId,
      tenantId,
      dateOfBirth: agedDateOfBirth(30),
      patientType: 'PRIVATE',
      hmoProviderId: null,
    });
    mockPrisma.consultation.findMany.mockResolvedValue([]);

    await expect(
      useCase.execute({ patientId }, tenantId, issuedById)
    ).rejects.toThrow(ValidationError);
  });
});
