/**
 * Generate Invoice Integration Tests
 *
 * Covers GenerateInvoiceUseCase — the largest billing use-case, responsible
 * for line-item pricing, exemption/insurance coverage math, and the
 * already-billed guard that prevents double-invoicing the same service.
 */

import { PrismaClient } from '@prisma/client';
import { GenerateInvoiceUseCase } from '../../application/use-cases/billing/generate-invoice.use-case';
import {
  createTestPrisma,
  createTestTenant,
  createTestUser,
  createTestPatient,
  createTestConsultation,
  cleanDatabase,
} from '../helpers/test-helpers';

describe('Generate Invoice Integration', () => {
  let prisma: PrismaClient;
  let useCase: GenerateInvoiceUseCase;
  let tenantId: string;
  let doctorId: string;
  let patientId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    const doctor = await createTestUser(prisma, tenantId, { role: 'DOCTOR', email: 'doc-gi@test.com' });
    doctorId = doctor.id;

    const patient = await createTestPatient(prisma, tenantId, {
      dateOfBirth: new Date('1990-01-01'), // ~36yo — outside any age exemption band used below
    });
    patientId = patient.id;

    useCase = new GenerateInvoiceUseCase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma, tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('should throw NotFoundError for a patient not belonging to the tenant', async () => {
    await expect(
      useCase.execute({ patientId: 'nonexistent-id' }, tenantId, doctorId)
    ).rejects.toThrow();
  });

  it('should throw ValidationError when no billable services are supplied', async () => {
    await expect(useCase.execute({ patientId }, tenantId, doctorId)).rejects.toThrow(
      'No billable services found'
    );
  });

  it('should generate an invoice from a completed consultation using the default consultation price', async () => {
    const consultation = await createTestConsultation(prisma, tenantId, patientId, doctorId);
    await prisma.consultation.update({ where: { id: consultation.id }, data: { status: 'COMPLETED' } });

    const invoice = await useCase.execute(
      { patientId, consultationIds: [consultation.id] },
      tenantId,
      doctorId
    );

    expect(invoice.items).toHaveLength(1);
    expect(Number(invoice.totalAmount)).toBe(5000); // no ServiceCatalog entry configured -> default price
    expect(Number(invoice.balance)).toBe(5000);
    expect(invoice.status).toBe('ISSUED');

    // The consultation must flip to BILLED so it can't be invoiced again
    const dbConsultation = await prisma.consultation.findUnique({ where: { id: consultation.id } });
    expect(dbConsultation?.billingStatus).toBe('BILLED');
  });

  it('should reject billing the same consultation a second time (double-billing guard)', async () => {
    const consultation = await createTestConsultation(prisma, tenantId, patientId, doctorId);
    await prisma.consultation.update({ where: { id: consultation.id }, data: { status: 'COMPLETED' } });

    await useCase.execute({ patientId, consultationIds: [consultation.id] }, tenantId, doctorId);

    await expect(
      useCase.execute({ patientId, consultationIds: [consultation.id] }, tenantId, doctorId)
    ).rejects.toThrow('already been billed');

    // Only one invoice should exist for this consultation
    const count = await prisma.invoiceLineItem.count({ where: { consultationId: consultation.id } });
    expect(count).toBe(1);
  });

  it('should not include a consultation that is not yet COMPLETED', async () => {
    const consultation = await createTestConsultation(prisma, tenantId, patientId, doctorId);
    // Left at the default 'DRAFT' status from createTestConsultation

    await expect(
      useCase.execute({ patientId, consultationIds: [consultation.id] }, tenantId, doctorId)
    ).rejects.toThrow('No billable services found');
  });

  it('should calculate totals correctly for additional manual items with tax and a global discount', async () => {
    const invoice = await useCase.execute(
      {
        patientId,
        additionalItems: [
          { serviceName: 'Wheelchair rental', quantity: 2, unitPrice: 1000, taxRate: 10 },
          { serviceName: 'Crutches', quantity: 1, unitPrice: 500 },
        ],
        discount: 200,
      },
      tenantId,
      doctorId
    );

    // subtotal (pre-tax): (2*1000) + (1*500) = 2500
    // tax: 2000 * 10% = 200
    // total: 2500 + 200 - 200(discount) = 2500
    expect(Number(invoice.subtotal)).toBe(2500);
    expect(Number(invoice.taxAmount)).toBe(200);
    expect(Number(invoice.totalAmount)).toBe(2500);
    expect(invoice.items).toHaveLength(2);
  });

  it('should apply an age-based exemption policy to reduce patient out-of-pocket balance without changing totalAmount', async () => {
    await prisma.exemptionPolicy.create({
      data: {
        tenantId,
        name: 'Under-5 free care',
        criteriaType: 'AGE',
        criteriaValue: '<5',
        discountPercentage: 100,
      },
    });

    const childPatient = await createTestPatient(prisma, tenantId, {
      firstName: 'Baby',
      lastName: 'Test',
      dateOfBirth: new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000), // ~2 years old
      phone: '+2348099999999',
    });

    const consultation = await createTestConsultation(prisma, tenantId, childPatient.id, doctorId);
    await prisma.consultation.update({ where: { id: consultation.id }, data: { status: 'COMPLETED' } });

    const invoice = await useCase.execute(
      { patientId: childPatient.id, consultationIds: [consultation.id] },
      tenantId,
      doctorId
    );

    // Full billed amount is preserved...
    expect(Number(invoice.totalAmount)).toBe(5000);
    // ...but the exemption zeroes out what the patient actually owes.
    expect(Number(invoice.balance)).toBe(0);
  });
});
