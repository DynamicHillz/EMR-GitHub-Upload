/**
 * Test Helpers
 *
 * Utilities for testing including Prisma client creation,
 * database cleanup, and mock data factories
 */

import { PrismaClient } from '@prisma/client';
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

  // Delete in correct order to respect foreign key constraints
  await prisma.refund.deleteMany({ where: { tenantId } });
  await prisma.payment.deleteMany({ where: { tenantId } });
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.dispensingRecord.deleteMany({ where: { tenantId } });
  await prisma.prescription.deleteMany({ where: { tenantId } });
  await prisma.labTest.deleteMany({ where: { tenantId } });
  await prisma.consultation.deleteMany({ where: { tenantId } });
  await prisma.appointment.deleteMany({ where: { tenantId } });
  await prisma.patient.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
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
  bloodGroup: 'O+' as const,
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

  return tenant;
}

/**
 * Create a test user
 */
export async function createTestUser(
  prisma: PrismaClient,
  tenantId: string,
  userData: Partial<typeof mockUserData> = {}
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
      status: 'DRAFT',
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
      lineItems: JSON.stringify(lineItems),
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
