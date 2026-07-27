/**
 * Check Drug Interactions Integration Tests
 *
 * Covers CheckDrugInteractionsUseCase — the standalone interaction-check
 * endpoint a doctor/pharmacist can call before committing to a new
 * medication. Reuses the already-seeded DrugInteraction reference data
 * (globally unique on drug1+drug2 across tenants) rather than inserting
 * new rows that would collide with it.
 */

import { PrismaClient } from '@prisma/client';
import { CheckDrugInteractionsUseCase } from '../../application/use-cases/pharmacy/check-drug-interactions.use-case';
import {
  createTestPrisma,
  createTestTenant,
  createTestUser,
  createTestPatient,
  createTestPrescription,
  cleanDatabase,
} from '../helpers/test-helpers';

describe('Check Drug Interactions Integration', () => {
  let prisma: PrismaClient;
  let useCase: CheckDrugInteractionsUseCase;
  let tenantId: string;
  let doctorId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    const doctor = await createTestUser(prisma, tenantId, { role: 'DOCTOR', email: 'doc-cdi@test.com' });
    doctorId = doctor.id;

    useCase = new CheckDrugInteractionsUseCase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma, tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('should report no interactions for a patient with no active prescriptions', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348022220001' } as any);

    const result = await useCase.execute({ patientId: patient.id, medicationName: 'Aspirin' }, tenantId);

    expect(result.hasInteractions).toBe(false);
    expect(result.interactions).toHaveLength(0);
  });

  it('should detect a CRITICAL interaction with a currently dispensed medication', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348022220002' } as any);

    await createTestPrescription(prisma, tenantId, patient.id, doctorId, {
      medicationName: 'Warfarin',
      status: 'DISPENSED',
      dispensedAt: new Date(),
    });

    const result = await useCase.execute({ patientId: patient.id, medicationName: 'Aspirin' }, tenantId);

    expect(result.hasInteractions).toBe(true);
    expect(result.interactions.some((i) => i.severity === 'CRITICAL')).toBe(true);
  });

  it('should not flag an interaction for a prescription dispensed more than 30 days ago', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348022220003' } as any);

    await createTestPrescription(prisma, tenantId, patient.id, doctorId, {
      medicationName: 'Warfarin',
      status: 'DISPENSED',
      dispensedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
    });

    const result = await useCase.execute({ patientId: patient.id, medicationName: 'Aspirin' }, tenantId);

    expect(result.hasInteractions).toBe(false);
  });

  it('should not flag an interaction for a PENDING (not yet dispensed) prescription', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348022220004' } as any);

    await createTestPrescription(prisma, tenantId, patient.id, doctorId, {
      medicationName: 'Warfarin',
      status: 'PENDING',
    });

    const result = await useCase.execute({ patientId: patient.id, medicationName: 'Aspirin' }, tenantId);

    expect(result.hasInteractions).toBe(false);
  });

  it('should check interactions in both directions (new drug as drug1 or drug2 in the reference row)', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348022220005' } as any);

    // Reference row is stored as drug1: 'Warfarin', drug2: 'Ibuprofen'.
    // Here the *active* medication is Ibuprofen and the *candidate* is Warfarin —
    // the reverse pairing from the seeded row.
    await createTestPrescription(prisma, tenantId, patient.id, doctorId, {
      medicationName: 'Ibuprofen',
      status: 'DISPENSED',
      dispensedAt: new Date(),
    });

    const result = await useCase.execute({ patientId: patient.id, medicationName: 'Warfarin' }, tenantId);

    expect(result.hasInteractions).toBe(true);
  });
});
