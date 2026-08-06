/**
 * Test Helpers
 *
 * Utilities for testing including Prisma client creation,
 * database cleanup, and mock data factories
 */

import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a test Prisma client
 *
 * Note: Uses the same database as development. For production testing,
 * you should use a separate test database by setting DATABASE_URL in .env.test
 */
export function createTestPrisma(): PrismaClient {
  const prisma = new PrismaClient({
    log: ['error'] // Only log errors in tests
  });

  return prisma;
}

/**
 * Clean database tables for testing
 *
 * WARNING: This will delete data! Only use in test environment
 */
export async function cleanDatabase(prisma: PrismaClient, tenantId: string) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('cleanDatabase can only be called in test environment');
  }

  // Delete in correct order to respect foreign key constraints (children
  // before the parents they reference — most FKs here are Restrict/NoAction,
  // not Cascade, so the order genuinely matters).
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.refund.deleteMany({ where: { tenantId } });
  await prisma.paymentAuditLog.deleteMany({ where: { tenantId } });
  await prisma.payment.deleteMany({ where: { tenantId } });
  await prisma.insuranceClaim.deleteMany({ where: { tenantId } });
  await prisma.invoiceLineItem.deleteMany({ where: { invoice: { tenantId } } });
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.dischargeSummary.deleteMany({ where: { tenantId } });
  await prisma.admissionDiagnosis.deleteMany({ where: { tenantId } });
  await prisma.medicationAdministration.deleteMany({ where: { tenantId } });
  // Maternity models — must run before admission (LaborRecord.admissionId is
  // a required FK) and before patient (all of these reference Patient), in
  // FK-dependency order (children before the parents they reference).
  await prisma.worklistDismissal.deleteMany({ where: { tenantId } });
  await prisma.partographObservation.deleteMany({ where: { tenantId } });
  await prisma.postnatalVisit.deleteMany({ where: { tenantId } });
  await prisma.laborRecord.deleteMany({ where: { tenantId } });
  await prisma.ancVisit.deleteMany({ where: { tenantId } });
  await prisma.ancPregnancy.deleteMany({ where: { tenantId } });
  await prisma.nextOfKin.deleteMany({ where: { tenantId } });
  await prisma.admission.deleteMany({ where: { tenantId } });
  await prisma.bed.deleteMany({ where: { tenantId } });
  await prisma.ward.deleteMany({ where: { tenantId } });
  await prisma.exemptionPolicy.deleteMany({ where: { tenantId } });
  await prisma.patientInsurance.deleteMany({ where: { tenantId } });
  await prisma.insuranceProvider.deleteMany({ where: { tenantId } });
  await prisma.dispensingRecord.deleteMany({ where: { tenantId } });
  await prisma.medicationBatch.deleteMany({ where: { tenantId } });
  await prisma.medication.deleteMany({ where: { tenantId } });
  // LabOrder cascades to LabTestRecord (and its LabResultValue children), so
  // this must run before LabTest (LabTestRecord.test is Restrict) and before
  // Consultation (LabOrder.consultationId is Restrict).
  await prisma.labOrder.deleteMany({ where: { tenantId } });
  await prisma.labTest.deleteMany({ where: { tenantId } });
  await prisma.labParameter.deleteMany({ where: { tenantId } });
  await prisma.notification.deleteMany({ where: { tenantId } });
  await prisma.refreshToken.deleteMany({ where: { user: { tenantId } } });
  await prisma.passwordResetToken.deleteMany({ where: { user: { tenantId } } });
  await prisma.prescription.deleteMany({ where: { tenantId } });
  await prisma.consultation.deleteMany({ where: { tenantId } });
  await prisma.appointment.deleteMany({ where: { tenantId } });
  await prisma.patient.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.fraudPreventionSettings.deleteMany({ where: { tenantId } });
}

/**
 * Mock Data Factories
 */

export const mockPatientData = {
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: new Date('1990-01-01'),
  gender: 'MALE' as const,
  phone: '+2348012345678',
  email: 'john.doe@example.com',
  address: '123 Test Street, Lagos',
  bloodGroup: 'O_POSITIVE' as const,
  genotype: 'AA' as const
};

export const mockUserData = {
  firstName: 'Test',
  lastName: 'Doctor',
  email: 'test.doctor@example.com',
  phone: '+2348087654321',
  role: 'DOCTOR' as const,
  status: 'ACTIVE' as const
};

export const mockConsultationData = {
  subjective: 'Patient complains of headache',
  objective: 'Temperature: 37.5°C, BP: 120/80',
  assessment: 'Mild headache, likely tension',
  plan: 'Prescribe paracetamol, rest',
  bloodPressure: '120/80',
  heartRate: 72,
  temperature: 37.5,
  weight: 70,
  height: 175,
  spO2: 98
};

export const mockAppointmentData = {
  appointmentDate: new Date(Date.now() + 86400000), // Tomorrow
  appointmentTime: '10:00',
  duration: 30,
  appointmentType: 'CONSULTATION' as const,
  status: 'SCHEDULED' as const,
  reason: 'Regular checkup'
};

export const mockInvoiceLineItem = {
  id: uuidv4(),
  description: 'Consultation Fee',
  quantity: 1,
  unitPrice: 5000,
  amount: 5000
};

/**
 * Create a test tenant
 */
export async function createTestTenant(prisma: PrismaClient) {
  const tenantId = `test-tenant-${uuidv4()}`;

  const tenant = await prisma.tenant.create({
    data: {
      id: tenantId,
      name: 'Test Clinic',
      clinicName: 'Test Clinic',
      slug: `test-clinic-${Date.now()}`,
      status: 'ACTIVE',
      subscriptionTier: 'BASIC',
      settings: {}
    }
  });

  // Create default fraud prevention settings for the test tenant
  await prisma.fraudPreventionSettings.create({
    data: {
      tenantId: tenant.id,
      requireReceiptPhotoForCash: false,
      requireReferenceForBankTransfer: false,
      requireReferenceForMobileMoney: false,
      duplicateDetectionEnabled: false,
      enableDailyLimits: false,
      autoFlagLargeAmounts: false,
      autoFlagMultiplePaymentsSameInvoice: false,
      requireDailyReconciliation: false
    }
  });

  return tenant;
}

/**
 * Create a test user
 */
export async function createTestUser(
  prisma: PrismaClient,
  tenantId: string,
  userData: Partial<Omit<typeof mockUserData, 'role' | 'status'> & { role: UserRole; status: UserStatus }> = {}
) {
  const bcrypt = require('bcrypt');
  const hashedPassword = await bcrypt.hash('testpassword123', 4);

  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName: userData.firstName || mockUserData.firstName,
      lastName: userData.lastName || mockUserData.lastName,
      email: userData.email || `test-${uuidv4()}@example.com`,
      phone: userData.phone || mockUserData.phone,
      password: hashedPassword,
      role: userData.role || mockUserData.role,
      status: userData.status ?? mockUserData.status
    }
  });

  return user;
}

/**
 * Create a test patient
 */
export async function createTestPatient(
  prisma: PrismaClient,
  tenantId: string,
  patientData: Partial<typeof mockPatientData> = {}
) {
  // Generate unique patient ID
  const count = await prisma.patient.count({ where: { tenantId } });
  const patientId = `PT${String(count + 1).padStart(6, '0')}`;

  const patient = await prisma.patient.create({
    data: {
      tenantId,
      patientId,
      firstName: patientData.firstName || mockPatientData.firstName,
      lastName: patientData.lastName || mockPatientData.lastName,
      dateOfBirth: patientData.dateOfBirth || mockPatientData.dateOfBirth,
      gender: patientData.gender || mockPatientData.gender,
      phone: patientData.phone || mockPatientData.phone,
      email: patientData.email,
      address: patientData.address,
      bloodGroup: patientData.bloodGroup,
      genotype: patientData.genotype
    }
  });

  return patient;
}

/**
 * Create a test appointment
 */
export async function createTestAppointment(
  prisma: PrismaClient,
  tenantId: string,
  patientId: string,
  doctorId: string,
  appointmentData: Partial<typeof mockAppointmentData> = {}
) {
  const appointment = await prisma.appointment.create({
    data: {
      tenantId,
      patientId,
      doctorId,
      appointmentDate: appointmentData.appointmentDate || mockAppointmentData.appointmentDate,
      appointmentTime: appointmentData.appointmentTime || mockAppointmentData.appointmentTime,
      duration: appointmentData.duration || mockAppointmentData.duration,
      appointmentType: appointmentData.appointmentType || mockAppointmentData.appointmentType,
      status: appointmentData.status || mockAppointmentData.status,
      reason: appointmentData.reason || mockAppointmentData.reason
    }
  });

  return appointment;
}

/**
 * Create a test consultation
 */
export async function createTestConsultation(
  prisma: PrismaClient,
  tenantId: string,
  patientId: string,
  doctorId: string,
  consultationData: Partial<typeof mockConsultationData> = {}
) {
  const data = { ...mockConsultationData, ...consultationData };

  // Calculate BMI if weight and height provided
  let bmi: number | undefined;
  if (data.weight && data.height) {
    const heightInMeters = data.height / 100;
    bmi = data.weight / (heightInMeters * heightInMeters);
  }

  const consultation = await prisma.consultation.create({
    data: {
      tenantId,
      patientId,
      doctorId,
      subjective: data.subjective,
      objective: data.objective,
      assessment: data.assessment,
      plan: data.plan,
      bloodPressure: data.bloodPressure,
      heartRate: data.heartRate,
      temperature: data.temperature,
      weight: data.weight,
      height: data.height,
      bmi,
      spO2: data.spO2,
      status: 'IN_PROGRESS',
      icd10Codes: '[]'
    }
  });

  return consultation;
}

/**
 * Create a test invoice
 */
export async function createTestInvoice(
  prisma: PrismaClient,
  tenantId: string,
  patientId: string,
  issuedById: string,
  lineItems: any[] = [mockInvoiceLineItem]
) {
  // Generate invoice number
  const count = await prisma.invoice.count({ where: { tenantId } });
  const invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      patientId,
      issuedById,
      invoiceNumber,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000), // 30 days from now
      items: {
        create: lineItems.map((item) => ({
          serviceCode: item.serviceCode || 'MISC',
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.amount,
          patientOutOfPocket: item.amount
        }))
      },
      subtotal: totalAmount,
      taxAmount: 0,
      discount: 0,
      totalAmount,
      paidAmount: 0,
      balance: totalAmount,
      status: 'ISSUED',
      paymentStatus: 'UNPAID'
    }
  });

  return invoice;
}

/**
 * Create a test medication
 */
export async function createTestMedication(
  prisma: PrismaClient,
  tenantId: string,
  overrides: Partial<{
    name: string;
    dosageForm: string;
    strength: string;
    stockLevel: number;
    unitPrice: number;
  }> = {}
) {
  return prisma.medication.create({
    data: {
      tenantId,
      name: overrides.name || 'Amoxicillin',
      dosageForm: overrides.dosageForm || 'Capsule',
      strength: overrides.strength || '500mg',
      stockLevel: overrides.stockLevel ?? 100,
      unitPrice: overrides.unitPrice ?? 500
    }
  });
}

/**
 * Create a test medication batch
 */
export async function createTestMedicationBatch(
  prisma: PrismaClient,
  tenantId: string,
  medicationId: string,
  overrides: Partial<{
    batchNumber: string;
    quantity: number;
    expiryDate: Date;
    unitCost: number;
    sellingPrice: number;
  }> = {}
) {
  return prisma.medicationBatch.create({
    data: {
      tenantId,
      medicationId,
      batchNumber: overrides.batchNumber || `BATCH-${uuidv4().slice(0, 8)}`,
      quantity: overrides.quantity ?? 50,
      expiryDate: overrides.expiryDate || new Date(Date.now() + 365 * 86400000),
      unitCost: overrides.unitCost ?? 300,
      sellingPrice: overrides.sellingPrice ?? 500
    }
  });
}

/**
 * Create a test prescription
 */
export async function createTestPrescription(
  prisma: PrismaClient,
  tenantId: string,
  patientId: string,
  doctorId: string,
  overrides: Partial<{
    medicationName: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    status: 'PENDING' | 'DISPENSED' | 'CANCELLED';
    dispensedAt: Date;
  }> = {}
) {
  return prisma.prescription.create({
    data: {
      tenantId,
      patientId,
      doctorId,
      medicationName: overrides.medicationName || 'Amoxicillin',
      dosage: overrides.dosage || '500mg',
      frequency: overrides.frequency || 'Twice daily',
      duration: overrides.duration || '7 days',
      quantity: overrides.quantity ?? 14,
      status: overrides.status || 'PENDING',
      dispensedAt: overrides.dispensedAt
    }
  });
}

/**
 * Create a test ward
 */
export async function createTestWard(
  prisma: PrismaClient,
  tenantId: string,
  overrides: Partial<{ name: string; type: string; capacity: number; dailyCost: number }> = {}
) {
  return prisma.ward.create({
    data: {
      tenantId,
      name: overrides.name || 'General Ward',
      type: overrides.type || 'General',
      capacity: overrides.capacity ?? 10,
      dailyCost: overrides.dailyCost ?? 5000
    }
  });
}

/**
 * Create a test bed within a ward
 */
export async function createTestBed(
  prisma: PrismaClient,
  tenantId: string,
  wardId: string,
  overrides: Partial<{ bedNumber: string; status: string }> = {}
) {
  return prisma.bed.create({
    data: {
      tenantId,
      wardId,
      bedNumber: overrides.bedNumber || `BED-${uuidv4().slice(0, 8)}`,
      status: overrides.status || 'AVAILABLE'
    }
  });
}

/**
 * Create a test admission, defaulting to a currently-admitted patient in
 * an OCCUPIED bed (mirrors what InpatientService.admitPatient does).
 */
export async function createTestAdmission(
  prisma: PrismaClient,
  tenantId: string,
  patientId: string,
  bedId: string,
  admittedById: string,
  overrides: Partial<{
    reason: string;
    status: string;
    admissionDate: Date;
    dischargeDate: Date | null;
    bedClearedAt: Date | null;
    billingStatus: string;
  }> = {}
) {
  await prisma.bed.update({ where: { id: bedId }, data: { status: 'OCCUPIED' } });

  return prisma.admission.create({
    data: {
      tenantId,
      patientId,
      bedId,
      admittedById,
      reason: overrides.reason || 'Test admission',
      status: overrides.status || 'ADMITTED',
      admissionDate: overrides.admissionDate || new Date(),
      dischargeDate: overrides.dischargeDate,
      bedClearedAt: overrides.bedClearedAt,
      billingStatus: overrides.billingStatus || 'UNBILLED'
    }
  });
}

/**
 * Create a test lab test (catalog entry) with one parameter attached
 */
export async function createTestLabTest(
  prisma: PrismaClient,
  tenantId: string,
  overrides: Partial<{ name: string; category: string; price: number }> = {}
) {
  return prisma.labTest.create({
    data: {
      tenantId,
      name: overrides.name || 'Full Blood Count',
      category: overrides.category || 'Hematology',
      price: overrides.price ?? 2000
    }
  });
}

/**
 * Create a test lab parameter and attach it to a lab test
 */
export async function createTestLabParameter(
  prisma: PrismaClient,
  tenantId: string,
  testId: string,
  overrides: Partial<{ name: string; unit: string; deltaCheckPercentage: number; refRangeMale: string; refRangeFemale: string }> = {}
) {
  const parameter = await prisma.labParameter.create({
    data: {
      tenantId,
      name: overrides.name || 'Hemoglobin',
      unit: overrides.unit || 'g/dL',
      deltaCheckPercentage: overrides.deltaCheckPercentage,
      refRangeMale: overrides.refRangeMale,
      refRangeFemale: overrides.refRangeFemale
    }
  });

  await prisma.labTestParameter.create({
    data: { testId, parameterId: parameter.id, displayOrder: 1 }
  });

  return parameter;
}

/**
 * Create a test lab order
 */
export async function createTestLabOrder(
  prisma: PrismaClient,
  tenantId: string,
  patientId: string,
  orderedById: string,
  overrides: Partial<{ urgency: 'ROUTINE' | 'STAT' | 'URGENT' }> = {}
) {
  return prisma.labOrder.create({
    data: {
      tenantId,
      patientId,
      orderedById,
      urgency: overrides.urgency || 'ROUTINE'
    }
  });
}

/**
 * Create a test lab test record (an ordered test awaiting/undergoing results entry)
 */
export async function createTestLabTestRecord(
  prisma: PrismaClient,
  tenantId: string,
  orderId: string,
  testId: string,
  overrides: Partial<{ status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' }> = {}
) {
  return prisma.labTestRecord.create({
    data: {
      tenantId,
      orderId,
      testId,
      status: overrides.status || 'IN_PROGRESS'
    }
  });
}
