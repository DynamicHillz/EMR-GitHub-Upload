/**
 * Dispense Medication Integration Tests
 *
 * Covers DispenseMedicationUseCase — the patient-safety-critical gate that
 * blocks dispensing on allergy match or a CRITICAL drug interaction, and
 * must correctly and atomically decrement stock.
 */

import { PrismaClient } from '@prisma/client';
import { DispenseMedicationUseCase } from '../../application/use-cases/pharmacy/dispense-medication.use-case';
import {
  createTestPrisma,
  createTestTenant,
  createTestUser,
  createTestPatient,
  createTestMedication,
  createTestMedicationBatch,
  createTestPrescription,
  cleanDatabase,
} from '../helpers/test-helpers';

describe('Dispense Medication Integration', () => {
  let prisma: PrismaClient;
  let useCase: DispenseMedicationUseCase;
  let tenantId: string;
  let pharmacistId: string;
  let doctorId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    const pharmacist = await createTestUser(prisma, tenantId, { role: 'PHARMACIST', email: 'pharm@test.com' });
    pharmacistId = pharmacist.id;

    const doctor = await createTestUser(prisma, tenantId, { role: 'DOCTOR', email: 'doc-dm@test.com' });
    doctorId = doctor.id;

    useCase = new DispenseMedicationUseCase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma, tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('should block dispensing when the medication matches a patient allergy', async () => {
    const patient = await createTestPatient(prisma, tenantId, {
      phone: '+2348011110001',
    } as any);
    await prisma.patient.update({ where: { id: patient.id }, data: { allergies: ['Penicillin'] } });

    const medication = await createTestMedication(prisma, tenantId, { name: 'Amoxicillin' });
    const batch = await createTestMedicationBatch(prisma, tenantId, medication.id, { quantity: 20 });
    const prescription = await createTestPrescription(prisma, tenantId, patient.id, doctorId, {
      medicationName: 'Amoxicillin',
    });

    await expect(
      useCase.execute(
        { prescriptionId: prescription.id, batchId: batch.id, quantityDispensed: 5 },
        pharmacistId,
        tenantId
      )
    ).rejects.toThrow('ALLERGY WARNING');

    // Nothing should have moved
    const dbBatch = await prisma.medicationBatch.findUnique({ where: { id: batch.id } });
    expect(dbBatch?.quantity).toBe(20);
    const dbPrescription = await prisma.prescription.findUnique({ where: { id: prescription.id } });
    expect(dbPrescription?.status).toBe('PENDING');
  });

  it('should block dispensing on a CRITICAL drug interaction with a currently active prescription', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110002' } as any);

    await createTestPrescription(prisma, tenantId, patient.id, doctorId, {
      medicationName: 'Warfarin',
      status: 'DISPENSED',
      dispensedAt: new Date(),
    });

    // DrugInteraction rows are a global clinical reference (unique on
    // drug1+drug2 across all tenants, not tenant-scoped), and this exact
    // pair is already part of the seeded reference data — reuse it instead
    // of inserting a duplicate that would violate the unique constraint.
    const existing = await prisma.drugInteraction.findFirst({
      where: {
        OR: [
          { drug1: 'Warfarin', drug2: 'Aspirin' },
          { drug1: 'Aspirin', drug2: 'Warfarin' },
        ],
      },
    });
    expect(existing?.severity).toBe('CRITICAL');

    const medication = await createTestMedication(prisma, tenantId, { name: 'Aspirin' });
    const batch = await createTestMedicationBatch(prisma, tenantId, medication.id, { quantity: 30 });
    const prescription = await createTestPrescription(prisma, tenantId, patient.id, doctorId, {
      medicationName: 'Aspirin',
    });

    await expect(
      useCase.execute(
        { prescriptionId: prescription.id, batchId: batch.id, quantityDispensed: 10 },
        pharmacistId,
        tenantId
      )
    ).rejects.toThrow('CRITICAL DRUG INTERACTION');

    const dbBatch = await prisma.medicationBatch.findUnique({ where: { id: batch.id } });
    expect(dbBatch?.quantity).toBe(30);
  });

  it('should dispense successfully, decrementing batch and medication stock and completing the prescription', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110003' } as any);
    const medication = await createTestMedication(prisma, tenantId, {
      name: 'Paracetamol',
      stockLevel: 200,
    });
    const batch = await createTestMedicationBatch(prisma, tenantId, medication.id, { quantity: 40 });
    const prescription = await createTestPrescription(prisma, tenantId, patient.id, doctorId, {
      medicationName: 'Paracetamol',
      quantity: 10,
    });

    const result = await useCase.execute(
      { prescriptionId: prescription.id, batchId: batch.id, quantityDispensed: 10 },
      pharmacistId,
      tenantId
    );

    expect(result.batchNumber).toBe(batch.batchNumber);
    expect(result.warnings.allergy).toBe(false);

    const dbBatch = await prisma.medicationBatch.findUnique({ where: { id: batch.id } });
    expect(dbBatch?.quantity).toBe(30);

    const dbMedication = await prisma.medication.findUnique({ where: { id: medication.id } });
    expect(dbMedication?.stockLevel).toBe(190);

    const dbPrescription = await prisma.prescription.findUnique({ where: { id: prescription.id } });
    expect(dbPrescription?.status).toBe('DISPENSED');
    expect(dbPrescription?.dispensedBy).toBe(pharmacistId);
  });

  it('should reject dispensing more than the batch has available', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110004' } as any);
    const medication = await createTestMedication(prisma, tenantId, { name: 'Ibuprofen' });
    const batch = await createTestMedicationBatch(prisma, tenantId, medication.id, { quantity: 5 });
    const prescription = await createTestPrescription(prisma, tenantId, patient.id, doctorId, {
      medicationName: 'Ibuprofen',
    });

    await expect(
      useCase.execute(
        { prescriptionId: prescription.id, batchId: batch.id, quantityDispensed: 10 },
        pharmacistId,
        tenantId
      )
    ).rejects.toThrow('Insufficient stock');
  });

  it('should reject dispensing from an expired batch', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110005' } as any);
    const medication = await createTestMedication(prisma, tenantId, { name: 'Cough Syrup' });
    const batch = await createTestMedicationBatch(prisma, tenantId, medication.id, {
      quantity: 20,
      expiryDate: new Date(Date.now() - 86400000), // yesterday
    });
    const prescription = await createTestPrescription(prisma, tenantId, patient.id, doctorId, {
      medicationName: 'Cough Syrup',
    });

    await expect(
      useCase.execute(
        { prescriptionId: prescription.id, batchId: batch.id, quantityDispensed: 1 },
        pharmacistId,
        tenantId
      )
    ).rejects.toThrow('has expired');
  });

  it('should reject dispensing a prescription that is not PENDING', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110006' } as any);
    const medication = await createTestMedication(prisma, tenantId, { name: 'Vitamin C' });
    const batch = await createTestMedicationBatch(prisma, tenantId, medication.id, { quantity: 20 });
    const prescription = await createTestPrescription(prisma, tenantId, patient.id, doctorId, {
      medicationName: 'Vitamin C',
      status: 'CANCELLED',
    });

    await expect(
      useCase.execute(
        { prescriptionId: prescription.id, batchId: batch.id, quantityDispensed: 1 },
        pharmacistId,
        tenantId
      )
    ).rejects.toThrow('Cannot dispense prescription with status');
  });

  it('should not oversell stock when two dispenses race against the same batch', async () => {
    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348011110007' } as any);
    const medication = await createTestMedication(prisma, tenantId, { name: 'Metformin' });
    const batch = await createTestMedicationBatch(prisma, tenantId, medication.id, { quantity: 10 });

    const prescriptionA = await createTestPrescription(prisma, tenantId, patient.id, doctorId, {
      medicationName: 'Metformin',
    });
    const prescriptionB = await createTestPrescription(prisma, tenantId, patient.id, doctorId, {
      medicationName: 'Metformin',
    });

    // Two concurrent dispenses of 6 units each against a batch of 10 — only
    // one can succeed; the other must be rejected by the guarded update, not
    // both silently succeeding and taking the batch to -2.
    const results = await Promise.allSettled([
      useCase.execute(
        { prescriptionId: prescriptionA.id, batchId: batch.id, quantityDispensed: 6 },
        pharmacistId,
        tenantId
      ),
      useCase.execute(
        { prescriptionId: prescriptionB.id, batchId: batch.id, quantityDispensed: 6 },
        pharmacistId,
        tenantId
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const dbBatch = await prisma.medicationBatch.findUnique({ where: { id: batch.id } });
    expect(dbBatch?.quantity).toBe(4);
    expect(dbBatch!.quantity).toBeGreaterThanOrEqual(0);
  });
});
