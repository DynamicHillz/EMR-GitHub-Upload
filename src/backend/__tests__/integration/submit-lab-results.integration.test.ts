/**
 * Submit Lab Results Integration Tests
 *
 * Covers SubmitLabResultsUseCase — the highest patient-safety-value target
 * in the test plan: the auto-flagging logic (CRITICAL_HIGH/LOW, HIGH/LOW,
 * ABNORMAL, INVALID_VALUE) and the critical-vs-routine notification split.
 * A missed critical flag here is a real safety incident.
 */

import { PrismaClient } from '@prisma/client';
import { SubmitLabResultsUseCase } from '../../application/use-cases/lab/submit-lab-results.use-case';
import {
  createTestPrisma,
  createTestTenant,
  createTestUser,
  createTestPatient,
  createTestLabTest,
  createTestLabParameter,
  createTestLabOrder,
  createTestLabTestRecord,
  cleanDatabase,
} from '../helpers/test-helpers';

describe('Submit Lab Results Integration', () => {
  let prisma: PrismaClient;
  let useCase: SubmitLabResultsUseCase;
  let tenantId: string;
  let doctorId: string;
  let patientId: string;
  let testId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    const doctor = await createTestUser(prisma, tenantId, { role: 'DOCTOR', email: 'doc-lab@test.com' });
    doctorId = doctor.id;

    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348033330001' } as any);
    patientId = patient.id;

    const labTest = await createTestLabTest(prisma, tenantId, { name: 'Fasting Blood Sugar' });
    testId = labTest.id;

    useCase = new SubmitLabResultsUseCase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma, tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  async function createOrderAndRecord() {
    const order = await createTestLabOrder(prisma, tenantId, patientId, doctorId);
    const record = await createTestLabTestRecord(prisma, tenantId, order.id, testId);
    return { order, record };
  }

  it('should flag a value 20%+ above the reference max as CRITICAL_HIGH and notify with CRITICAL_LAB_RESULT', async () => {
    // Reference range comes from the server-side lab dictionary (the test
    // patient is MALE, so refRangeMale is what gets used), not from
    // client-supplied referenceMin/Max — see submit-lab-results.use-case.ts.
    const parameter = await createTestLabParameter(prisma, tenantId, testId, { name: 'Glucose', refRangeMale: '70-100' });
    const { order, record } = await createOrderAndRecord();

    // referenceMax 100 -> critical threshold is 120; 130 clears it
    await useCase.execute(
      record.id,
      { results: [{ parameter: 'Glucose', value: '130', unit: 'mg/dL' }] },
      tenantId
    );

    const resultValue = await prisma.labResultValue.findFirst({
      where: { testRecordId: record.id, parameterId: parameter.id },
    });
    expect(resultValue?.isCritical).toBe(true);
    expect(resultValue?.flagType).toBe('CRITICAL_HIGH');

    const notification = await prisma.notification.findFirst({
      where: { userId: doctorId, entityId: order.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(notification?.type).toBe('CRITICAL_LAB_RESULT');

    const dbRecord = await prisma.labTestRecord.findUnique({ where: { id: record.id } });
    expect(dbRecord?.status).toBe('COMPLETED');
  });

  it('should flag a value moderately above reference max as HIGH (not critical) and still notify LAB_RESULT_READY', async () => {
    const parameter = await createTestLabParameter(prisma, tenantId, testId, { name: 'Glucose-High', refRangeMale: '70-100' });
    const { order, record } = await createOrderAndRecord();

    // referenceMax 100, critical threshold 120; 110 is HIGH but not critical
    await useCase.execute(
      record.id,
      { results: [{ parameter: 'Glucose-High', value: '110', unit: 'mg/dL' }] },
      tenantId
    );

    const resultValue = await prisma.labResultValue.findFirst({
      where: { testRecordId: record.id, parameterId: parameter.id },
    });
    expect(resultValue?.isAbnormal).toBe(true);
    expect(resultValue?.isCritical).toBe(false);
    expect(resultValue?.flagType).toBe('HIGH');

    const notification = await prisma.notification.findFirst({
      where: { userId: doctorId, entityId: order.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(notification?.type).toBe('LAB_RESULT_READY');
  });

  it('should flag a value 20%+ below the reference min as CRITICAL_LOW', async () => {
    const parameter = await createTestLabParameter(prisma, tenantId, testId, { name: 'Potassium', refRangeMale: '3.5-5.0' });
    const { record } = await createOrderAndRecord();

    // referenceMin 3.5 -> critical threshold is 2.8; 2.5 clears it
    await useCase.execute(
      record.id,
      { results: [{ parameter: 'Potassium', value: '2.5', unit: 'mmol/L' }] },
      tenantId
    );

    const resultValue = await prisma.labResultValue.findFirst({
      where: { testRecordId: record.id, parameterId: parameter.id },
    });
    expect(resultValue?.flagType).toBe('CRITICAL_LOW');
    expect(resultValue?.isCritical).toBe(true);
  });

  it('should treat a value within range as normal (no flag)', async () => {
    const parameter = await createTestLabParameter(prisma, tenantId, testId, { name: 'Sodium', refRangeMale: '135-145' });
    const { record } = await createOrderAndRecord();

    await useCase.execute(
      record.id,
      { results: [{ parameter: 'Sodium', value: '140', unit: 'mmol/L' }] },
      tenantId
    );

    const resultValue = await prisma.labResultValue.findFirst({
      where: { testRecordId: record.id, parameterId: parameter.id },
    });
    expect(resultValue?.isAbnormal).toBe(false);
    expect(resultValue?.flagType).toBeNull();
  });

  it('should flag an unparseable value against a ranged parameter as INVALID_VALUE rather than silently normal', async () => {
    const parameter = await createTestLabParameter(prisma, tenantId, testId, { name: 'Creatinine', refRangeMale: '0.6-1.3' });
    const { record } = await createOrderAndRecord();

    await useCase.execute(
      record.id,
      { results: [{ parameter: 'Creatinine', value: 'N/A', unit: 'mg/dL' }] },
      tenantId
    );

    const resultValue = await prisma.labResultValue.findFirst({
      where: { testRecordId: record.id, parameterId: parameter.id },
    });
    expect(resultValue?.isAbnormal).toBe(true);
    expect(resultValue?.flagType).toBe('INVALID_VALUE');
  });

  it('should flag a non-numeric result outside its allowed value set as ABNORMAL', async () => {
    const parameter = await createTestLabParameter(prisma, tenantId, testId, { name: 'Urine Protein', refRangeMale: 'Negative' });
    const { record } = await createOrderAndRecord();

    await useCase.execute(
      record.id,
      { results: [{ parameter: 'Urine Protein', value: 'Positive', unit: '' }] },
      tenantId
    );

    const resultValue = await prisma.labResultValue.findFirst({
      where: { testRecordId: record.id, parameterId: parameter.id },
    });
    expect(resultValue?.isAbnormal).toBe(true);
    expect(resultValue?.flagType).toBe('ABNORMAL');
  });

  it('should raise a delta alert when a value changes beyond the parameter-configured threshold from a prior result', async () => {
    const parameter = await createTestLabParameter(prisma, tenantId, testId, {
      name: 'Hemoglobin-Delta',
      deltaCheckPercentage: 20,
    });

    // First (prior, COMPLETED) result: 14 g/dL
    const { record: firstRecord } = await createOrderAndRecord();
    await useCase.execute(
      firstRecord.id,
      { results: [{ parameter: 'Hemoglobin-Delta', value: '14', unit: 'g/dL' }] },
      tenantId
    );

    // Second result: 10 g/dL — a ~28.6% drop, over the 20% threshold
    const { record: secondRecord } = await createOrderAndRecord();
    await useCase.execute(
      secondRecord.id,
      { results: [{ parameter: 'Hemoglobin-Delta', value: '10', unit: 'g/dL' }] },
      tenantId
    );

    const secondResultValue = await prisma.labResultValue.findFirst({
      where: { testRecordId: secondRecord.id, parameterId: parameter.id },
    });
    expect(secondResultValue?.hasDeltaAlert).toBe(true);
    expect(secondResultValue?.deltaAlertNotes).toContain('Delta Check');
  });

  it('should reject submitting results for a test that is not IN_PROGRESS', async () => {
    const order = await createTestLabOrder(prisma, tenantId, patientId, doctorId);
    const record = await createTestLabTestRecord(prisma, tenantId, order.id, testId, { status: 'PENDING' });

    await expect(
      useCase.execute(record.id, { results: [] }, tenantId)
    ).rejects.toThrow('Can only submit results for tests that are IN_PROGRESS');
  });

  it('should throw for a lab test record that does not exist in this tenant', async () => {
    await expect(
      useCase.execute('nonexistent-id', { results: [] }, tenantId)
    ).rejects.toThrow('Lab test not found');
  });
});
