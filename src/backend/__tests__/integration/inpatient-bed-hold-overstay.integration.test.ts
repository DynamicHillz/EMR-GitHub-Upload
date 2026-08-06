/**
 * Post-Discharge Bed-Hold & Overstay Billing — Integration Tests
 *
 * Covers the stakeholder-requested behavior: a discharged patient's bed
 * should not free up automatically unless the stay has actually been paid
 * for. Exercises InpatientService.dischargePatient/confirmBedVacated/
 * getOverstayStatus (which use the shared Prisma singleton, so this runs
 * against the same database as the rest of the integration suite) and
 * GenerateInvoiceUseCase's accommodation/overstay line-item split.
 */

import { PrismaClient } from '@prisma/client';
import { InpatientService } from '../../domain/services/inpatient.service';
import { GenerateInvoiceUseCase } from '../../application/use-cases/billing/generate-invoice.use-case';
import {
  createTestPrisma,
  createTestTenant,
  createTestUser,
  createTestPatient,
  createTestWard,
  createTestBed,
  createTestAdmission,
  createTestInvoice,
  cleanDatabase,
} from '../helpers/test-helpers';

describe('Post-Discharge Bed-Hold & Overstay Billing', () => {
  let prisma: PrismaClient;
  let inpatientService: InpatientService;
  let generateInvoiceUseCase: GenerateInvoiceUseCase;
  let tenantId: string;
  let doctorId: string;
  let wardId: string;

  const msPerDay = 1000 * 60 * 60 * 24;

  beforeAll(async () => {
    prisma = createTestPrisma();

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    const doctor = await createTestUser(prisma, tenantId, { role: 'DOCTOR', email: 'doc-bedhold@test.com' });
    doctorId = doctor.id;

    const ward = await createTestWard(prisma, tenantId, { dailyCost: 5000 });
    wardId = ward.id;

    inpatientService = new InpatientService();
    generateInvoiceUseCase = new GenerateInvoiceUseCase(prisma);

    // The default is 2, but set it explicitly so the test doesn't depend on
    // the schema default ever changing.
    await prisma.tenant.update({ where: { id: tenantId }, data: { overstayGraceDays: 2 } });
  });

  afterAll(async () => {
    await cleanDatabase(prisma, tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('frees the bed immediately when the admission is billed and the invoice is already fully paid', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110001' });
    const bed = await createTestBed(prisma, tenantId, wardId);
    const admission = await createTestAdmission(prisma, tenantId, patient.id, bed.id, doctorId, {
      billingStatus: 'BILLED',
    });

    const invoice = await createTestInvoice(prisma, tenantId, patient.id, doctorId, [
      { description: 'Accommodation', quantity: 1, unitPrice: 5000, amount: 5000 },
    ]);
    await prisma.invoiceLineItem.updateMany({
      where: { invoiceId: invoice.id },
      data: { admissionId: admission.id },
    });
    await prisma.invoice.update({ where: { id: invoice.id }, data: { paidAmount: 5000, balance: 0 } });

    const result: any = await inpatientService.dischargePatient(tenantId, admission.id, {}, doctorId);

    expect(result.bedCleared).toBe(true);
    expect(result.bedClearedAt).not.toBeNull();

    const dbBed = await prisma.bed.findUnique({ where: { id: bed.id } });
    expect(dbBed?.status).toBe('AVAILABLE');
  });

  it('holds the bed when the admission has not been billed at all', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110002' });
    const bed = await createTestBed(prisma, tenantId, wardId);
    const admission = await createTestAdmission(prisma, tenantId, patient.id, bed.id, doctorId, {
      billingStatus: 'UNBILLED',
    });

    const result: any = await inpatientService.dischargePatient(tenantId, admission.id, {}, doctorId);

    expect(result.bedCleared).toBe(false);

    const dbBed = await prisma.bed.findUnique({ where: { id: bed.id } });
    expect(dbBed?.status).toBe('OCCUPIED');

    const dbAdmission = await prisma.admission.findUnique({ where: { id: admission.id } });
    expect(dbAdmission?.bedClearedAt).toBeNull();
  });

  it('holds the bed when the admission has been billed but the invoice still has a balance', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110003' });
    const bed = await createTestBed(prisma, tenantId, wardId);
    const admission = await createTestAdmission(prisma, tenantId, patient.id, bed.id, doctorId, {
      billingStatus: 'BILLED',
    });

    const invoice = await createTestInvoice(prisma, tenantId, patient.id, doctorId, [
      { description: 'Accommodation', quantity: 1, unitPrice: 5000, amount: 5000 },
    ]);
    await prisma.invoiceLineItem.updateMany({
      where: { invoiceId: invoice.id },
      data: { admissionId: admission.id },
    });
    // Simulate a partial payment — balance still outstanding.
    await prisma.invoice.update({ where: { id: invoice.id }, data: { paidAmount: 2000, balance: 3000 } });

    const result: any = await inpatientService.dischargePatient(tenantId, admission.id, {}, doctorId);

    expect(result.bedCleared).toBe(false);
    const dbBed = await prisma.bed.findUnique({ where: { id: bed.id } });
    expect(dbBed?.status).toBe('OCCUPIED');
  });

  it('frees the bed when the admission has been billed and the invoice is fully paid', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110004' });
    const bed = await createTestBed(prisma, tenantId, wardId);
    const admission = await createTestAdmission(prisma, tenantId, patient.id, bed.id, doctorId, {
      billingStatus: 'BILLED',
    });

    const invoice = await createTestInvoice(prisma, tenantId, patient.id, doctorId, [
      { description: 'Accommodation', quantity: 1, unitPrice: 5000, amount: 5000 },
    ]);
    await prisma.invoiceLineItem.updateMany({
      where: { invoiceId: invoice.id },
      data: { admissionId: admission.id },
    });
    await prisma.invoice.update({ where: { id: invoice.id }, data: { paidAmount: 5000, balance: 0 } });

    const result: any = await inpatientService.dischargePatient(tenantId, admission.id, {}, doctorId);

    expect(result.bedCleared).toBe(true);
    const dbBed = await prisma.bed.findUnique({ where: { id: bed.id } });
    expect(dbBed?.status).toBe('AVAILABLE');
  });

  it('confirmBedVacated frees a held bed regardless of payment status', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110005' });
    const bed = await createTestBed(prisma, tenantId, wardId);
    const admission = await createTestAdmission(prisma, tenantId, patient.id, bed.id, doctorId, {
      billingStatus: 'UNBILLED',
    });

    await inpatientService.dischargePatient(tenantId, admission.id, {}, doctorId);
    let dbBed = await prisma.bed.findUnique({ where: { id: bed.id } });
    expect(dbBed?.status).toBe('OCCUPIED');

    await inpatientService.confirmBedVacated(tenantId, admission.id);

    dbBed = await prisma.bed.findUnique({ where: { id: bed.id } });
    expect(dbBed?.status).toBe('AVAILABLE');

    const dbAdmission = await prisma.admission.findUnique({ where: { id: admission.id } });
    expect(dbAdmission?.bedClearedAt).not.toBeNull();
  });

  it('confirmBedVacated rejects an admission whose bed is already cleared', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110006' });
    const bed = await createTestBed(prisma, tenantId, wardId);
    const admission = await createTestAdmission(prisma, tenantId, patient.id, bed.id, doctorId, {
      billingStatus: 'BILLED',
    });

    const invoice = await createTestInvoice(prisma, tenantId, patient.id, doctorId, [
      { description: 'Accommodation', quantity: 1, unitPrice: 5000, amount: 5000 },
    ]);
    await prisma.invoiceLineItem.updateMany({
      where: { invoiceId: invoice.id },
      data: { admissionId: admission.id },
    });
    await prisma.invoice.update({ where: { id: invoice.id }, data: { paidAmount: 5000, balance: 0 } });

    await inpatientService.dischargePatient(tenantId, admission.id, {}, doctorId); // fully paid -> auto-clears

    await expect(inpatientService.confirmBedVacated(tenantId, admission.id)).rejects.toThrow(
      'already been marked as vacated'
    );
  });

  it('getOverstayStatus reports the grace period remaining before it elapses, and overstay/estimated charge after', async () => {
    const patientWithinGrace = await createTestPatient(prisma, tenantId, { phone: '+2348011110007' });
    const bedWithinGrace = await createTestBed(prisma, tenantId, wardId);
    const admissionWithinGrace = await createTestAdmission(prisma, tenantId, patientWithinGrace.id, bedWithinGrace.id, doctorId, {
      status: 'DISCHARGED',
      dischargeDate: new Date(Date.now() - 1 * msPerDay), // 1 day ago, grace = 2 days
      billingStatus: 'UNBILLED',
    });

    const patientPastGrace = await createTestPatient(prisma, tenantId, { phone: '+2348011110008' });
    const bedPastGrace = await createTestBed(prisma, tenantId, wardId);
    const admissionPastGrace = await createTestAdmission(prisma, tenantId, patientPastGrace.id, bedPastGrace.id, doctorId, {
      status: 'DISCHARGED',
      dischargeDate: new Date(Date.now() - 5 * msPerDay), // 5 days ago, grace = 2 days -> 3 days overstay
      billingStatus: 'UNBILLED',
    });

    const statuses = await inpatientService.getOverstayStatus(tenantId);

    const withinGrace = statuses.find((s: any) => s.admissionId === admissionWithinGrace.id);
    expect(withinGrace).toBeDefined();
    expect(withinGrace.isOverstay).toBe(false);
    expect(withinGrace.graceDaysRemaining).toBe(1);
    expect(withinGrace.overstayDays).toBe(0);
    expect(withinGrace.estimatedExtraCharge).toBe(0);

    const pastGrace = statuses.find((s: any) => s.admissionId === admissionPastGrace.id);
    expect(pastGrace).toBeDefined();
    expect(pastGrace.isOverstay).toBe(true);
    expect(pastGrace.graceDaysRemaining).toBe(0);
    expect(pastGrace.overstayDays).toBe(3);
    expect(pastGrace.estimatedExtraCharge).toBe(3 * 5000); // ward.dailyCost
  });

  it('getOverstayStatus excludes admissions whose bed has already been cleared', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110009' });
    const bed = await createTestBed(prisma, tenantId, wardId);
    const admission = await createTestAdmission(prisma, tenantId, patient.id, bed.id, doctorId, {
      status: 'DISCHARGED',
      dischargeDate: new Date(Date.now() - 5 * msPerDay),
      bedClearedAt: new Date(),
      billingStatus: 'UNBILLED',
    });

    const statuses = await inpatientService.getOverstayStatus(tenantId);
    expect(statuses.find((s: any) => s.admissionId === admission.id)).toBeUndefined();
  });

  it('generate-invoice splits accommodation into a normal-stay line and a separate overstay line when the bed was held past the grace period', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110010' });
    const bed = await createTestBed(prisma, tenantId, wardId);

    const admissionDate = new Date(Date.now() - 10 * msPerDay);
    const dischargeDate = new Date(Date.now() - 5 * msPerDay); // 5 day stay
    const admission = await createTestAdmission(prisma, tenantId, patient.id, bed.id, doctorId, {
      admissionDate,
      status: 'DISCHARGED',
      dischargeDate,
      billingStatus: 'UNBILLED',
      // Bed still held (bedClearedAt null) -> billing runs through "now",
      // which is 5 days past discharge = 3 days past the 2-day grace period.
    });

    const invoice = await generateInvoiceUseCase.execute(
      { patientId: patient.id, admissionIds: [admission.id] },
      tenantId,
      doctorId
    );

    const accommodationItems = invoice.items.filter((i: any) =>
      ['ACCOMMODATION', 'ACCOMMODATION_OVERSTAY'].includes(i.serviceCode)
    );
    expect(accommodationItems).toHaveLength(2);

    const normalItem = accommodationItems.find((i: any) => i.serviceCode === 'ACCOMMODATION');
    const overstayItem = accommodationItems.find((i: any) => i.serviceCode === 'ACCOMMODATION_OVERSTAY');

    expect(normalItem?.quantity).toBe(5); // admission date -> discharge date
    expect(overstayItem?.quantity).toBeGreaterThanOrEqual(2); // ~3 days past grace, allow for timing slack
    expect(overstayItem?.description).toContain('Overstay');

    const dbAdmission = await prisma.admission.findUnique({ where: { id: admission.id } });
    expect(dbAdmission?.billingStatus).toBe('BILLED');
  });

  it('generate-invoice produces only a single accommodation line when discharge is still within the grace period', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110011' });
    const bed = await createTestBed(prisma, tenantId, wardId);

    const admissionDate = new Date(Date.now() - 4 * msPerDay);
    const dischargeDate = new Date(Date.now() - 1 * msPerDay); // discharged yesterday, grace = 2 days, still within it
    const admission = await createTestAdmission(prisma, tenantId, patient.id, bed.id, doctorId, {
      admissionDate,
      status: 'DISCHARGED',
      dischargeDate,
      billingStatus: 'UNBILLED',
    });

    const invoice = await generateInvoiceUseCase.execute(
      { patientId: patient.id, admissionIds: [admission.id] },
      tenantId,
      doctorId
    );

    const accommodationItems = invoice.items.filter((i: any) =>
      ['ACCOMMODATION', 'ACCOMMODATION_OVERSTAY'].includes(i.serviceCode)
    );
    expect(accommodationItems).toHaveLength(1);
    expect(accommodationItems[0].serviceCode).toBe('ACCOMMODATION');
    expect(accommodationItems[0].quantity).toBe(3); // admission date -> discharge date
  });
});
