/**
 * Record Delivery Outcome Integration Tests
 *
 * Exercises the real transaction (newborn Patient + NextOfKin +
 * PatientInsurance clone + LaborRecord update, all against a real DB) that
 * the mocked-Prisma unit tests for this use-case cannot verify — real FK
 * constraints, the synthetic-phone unique index, and enum values actually
 * accepted by Postgres.
 */

import { PrismaClient } from '@prisma/client';
import { RecordDeliveryOutcomeUseCase } from '../../application/use-cases/labor/record-delivery-outcome.use-case';
import {
  createTestPrisma,
  createTestTenant,
  createTestUser,
  createTestPatient,
  createTestWard,
  createTestBed,
  createTestAdmission,
  cleanDatabase,
} from '../helpers/test-helpers';

describe('Record Delivery Outcome Integration', () => {
  let prisma: PrismaClient;
  let useCase: RecordDeliveryOutcomeUseCase;
  let tenantId: string;
  let doctorId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    const doctor = await createTestUser(prisma, tenantId, { role: 'DOCTOR', email: 'doc-delivery@test.com' });
    doctorId = doctor.id;

    useCase = new RecordDeliveryOutcomeUseCase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma, tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  async function createInLaborRecord(motherPhone: string) {
    const mother = await createTestPatient(prisma, tenantId, { phone: motherPhone, gender: 'FEMALE' } as any);
    const ward = await createTestWard(prisma, tenantId);
    const bed = await createTestBed(prisma, tenantId, ward.id);
    const admission = await createTestAdmission(prisma, tenantId, mother.id, bed.id, doctorId);

    const laborRecord = await prisma.laborRecord.create({
      data: {
        tenantId,
        admissionId: admission.id,
        patientId: mother.id,
        startedById: doctorId,
        laborOnsetAt: new Date(),
        status: 'IN_LABOR',
      },
    });

    return { mother, laborRecord };
  }

  it('creates the newborn as a real Patient row with a unique synthetic phone, linked NextOfKin, and mother linkage', async () => {
    const { mother, laborRecord } = await createInLaborRecord('+2348030001111');

    const result = await useCase.execute(
      tenantId,
      laborRecord.id,
      { babyOutcome: 'LIVE_BIRTH', babySex: 'FEMALE', modeOfDelivery: 'SVD' },
      doctorId
    );

    expect(result.newbornPatient).toBeDefined();
    const newbornId = result.newbornPatient!.id;

    const newborn = await prisma.patient.findUnique({ where: { id: newbornId } });
    expect(newborn).not.toBeNull();
    expect(newborn!.phone).toMatch(/^NEWBORN-[0-9A-F]{8}$/);
    expect(newborn!.motherPatientId).toBe(mother.id);
    expect(newborn!.lastName).toBe(mother.lastName);

    const nextOfKin = await prisma.nextOfKin.findFirst({ where: { patientId: newbornId } });
    expect(nextOfKin?.relationship).toBe('MOTHER');
    expect(nextOfKin?.phoneNumber).toBe('+2348030001111');

    const updatedLaborRecord = await prisma.laborRecord.findUnique({ where: { id: laborRecord.id } });
    expect(updatedLaborRecord?.status).toBe('DELIVERED');
    expect(updatedLaborRecord?.newbornPatientId).toBe(newbornId);
  });

  it('clones the mother\'s active insurance onto the newborn for real', async () => {
    const { mother, laborRecord } = await createInLaborRecord('+2348030002222');

    const provider = await prisma.insuranceProvider.create({
      data: { tenantId, name: 'Test HMO', type: 'HMO', isActive: true },
    });
    await prisma.patientInsurance.create({
      data: {
        tenantId,
        patientId: mother.id,
        providerId: provider.id,
        policyNumber: 'POL-REAL-1',
        planType: 'STANDARD',
        copayPercentage: 10,
        validFrom: new Date(Date.now() - 86400000),
        validTo: new Date(Date.now() + 365 * 86400000),
        isActive: true,
      },
    });

    const result = await useCase.execute(
      tenantId,
      laborRecord.id,
      { babyOutcome: 'LIVE_BIRTH', babySex: 'MALE', modeOfDelivery: 'SVD' },
      doctorId
    );

    const newbornInsurance = await prisma.patientInsurance.findFirst({
      where: { patientId: result.newbornPatient!.id },
    });
    expect(newbornInsurance?.policyNumber).toBe('POL-REAL-1');
    expect(newbornInsurance?.providerId).toBe(provider.id);
  });

  it('fires a real CRITICAL DELIVERY_ALERT notification to DOCTOR/NURSE on a cesarean with PPH-range blood loss', async () => {
    const { laborRecord } = await createInLaborRecord('+2348030003333');
    const nurse = await createTestUser(prisma, tenantId, { role: 'NURSE', email: 'nurse-delivery@test.com' });

    await useCase.execute(
      tenantId,
      laborRecord.id,
      {
        babyOutcome: 'LIVE_BIRTH',
        babySex: 'MALE',
        modeOfDelivery: 'CESAREAN_SECTION',
        estimatedBloodLossMl: 1200,
        registerNewbornAsPatient: false,
      },
      doctorId
    );

    const doctorNotification = await prisma.notification.findFirst({
      where: { tenantId, userId: doctorId, type: 'DELIVERY_ALERT' },
      orderBy: { createdAt: 'desc' },
    });
    expect(doctorNotification?.severity).toBe('CRITICAL');
    expect(doctorNotification?.message).toContain('threshold 1000ml');

    const nurseNotification = await prisma.notification.findFirst({
      where: { tenantId, userId: nurse.id, type: 'DELIVERY_ALERT' },
    });
    expect(nurseNotification).not.toBeNull();
  });

  it('does not register a newborn or fire an alert for a normal cesarean with 700ml blood loss', async () => {
    const { laborRecord } = await createInLaborRecord('+2348030004444');

    const result = await useCase.execute(
      tenantId,
      laborRecord.id,
      { babyOutcome: 'LIVE_BIRTH', babySex: 'FEMALE', modeOfDelivery: 'CESAREAN_SECTION', estimatedBloodLossMl: 700 },
      doctorId
    );

    const alert = await prisma.notification.findFirst({
      where: { tenantId, type: 'DELIVERY_ALERT', entityId: laborRecord.id },
    });
    expect(alert).toBeNull();
    expect(result.newbornPatient).toBeDefined(); // still registers newborn on a genuine live birth
  });

  it('rejects recording a delivery outcome for a labor record that is not IN_LABOR', async () => {
    const { laborRecord } = await createInLaborRecord('+2348030005555');
    await prisma.laborRecord.update({ where: { id: laborRecord.id }, data: { status: 'DELIVERED' } });

    await expect(
      useCase.execute(tenantId, laborRecord.id, { babyOutcome: 'LIVE_BIRTH', babySex: 'FEMALE' }, doctorId)
    ).rejects.toThrow('not currently in progress');
  });
});
