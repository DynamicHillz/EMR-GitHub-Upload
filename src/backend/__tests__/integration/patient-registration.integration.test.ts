/**
 * Patient Registration Integration Tests
 *
 * Tests the complete patient registration flow end-to-end
 * Verifies US-PAT-001: Patient Registration with database operations
 */

import { PrismaClient } from '@prisma/client';
import { RegisterPatientUseCase } from '../../application/use-cases/patient/register-patient.use-case';
import { GetPatientUseCase } from '../../application/use-cases/patient/get-patient.use-case';
import { UpdatePatientUseCase } from '../../application/use-cases/patient/update-patient.use-case';
import { PatientRepository } from '../../infrastructure/database/repositories/patient.repository';
import { PatientIdGenerator } from '../../infrastructure/generators/patient-id.generator';
import { RegisterPatientDto } from '../../application/dtos/patient/RegisterPatient.dto';
import {
  createTestPrisma,
  createTestTenant,
  cleanDatabase,
} from '../helpers/test-helpers';

describe('Patient Registration Integration', () => {
  let prisma: PrismaClient;
  let patientRepository: PatientRepository;
  let patientIdGenerator: PatientIdGenerator;
  let registerUseCase: RegisterPatientUseCase;
  let getUseCase: GetPatientUseCase;
  let updateUseCase: UpdatePatientUseCase;
  let tenantId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    patientRepository = new PatientRepository(prisma);
    patientIdGenerator = new PatientIdGenerator(prisma);
    registerUseCase = new RegisterPatientUseCase(patientRepository, patientIdGenerator);
    getUseCase = new GetPatientUseCase(patientRepository);
    updateUseCase = new UpdatePatientUseCase(patientRepository);
  });

  afterAll(async () => {
    await cleanDatabase(prisma, tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  describe('Complete Registration Flow', () => {
    it('should register patient, retrieve, and verify in database', async () => {
      // Arrange
      const registrationDto: RegisterPatientDto = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-15',
        gender: 'MALE',
        phone: '+2348012345678',
        email: 'john.doe@example.com',
        address: '123 Main Street, Lagos',
        bloodGroup: 'O+',
        allergies: ['Penicillin', 'Peanuts'],
        chronicConditions: ['Hypertension'],
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+2348087654321',
        },
        consentGiven: true,
      };

      // Act - Register
      const registered = await registerUseCase.execute(registrationDto, tenantId);

      // Assert - Registration response
      expect(registered.id).toBeDefined();
      expect(registered.patientId).toMatch(/^P\d{6}$/);
      expect(registered.firstName).toBe('John');
      expect(registered.lastName).toBe('Doe');
      expect(registered.fullName).toBe('John Doe');
      expect(registered.gender).toBe('MALE');
      expect(registered.phone).toBe('+2348012345678');
      expect(registered.email).toBe('john.doe@example.com');
      expect(registered.bloodGroup).toBe('O+');
      expect(registered.allergies).toEqual(['Penicillin', 'Peanuts']);
      expect(registered.chronicConditions).toEqual(['Hypertension']);
      expect(registered.hasAllergies).toBe(true);
      expect(registered.emergencyContact).toEqual({
        name: 'Jane Doe',
        relationship: 'Spouse',
        phone: '+2348087654321',
      });
      expect(registered.status).toBe('ACTIVE');
      expect(registered.consentGiven).toBe(true);

      // Retrieve by UUID
      const retrievedById = await getUseCase.executeById(registered.id, tenantId);
      expect(retrievedById.id).toBe(registered.id);
      expect(retrievedById.patientId).toBe(registered.patientId);

      // Retrieve by patient number
      const retrievedByPatientId = await getUseCase.executeByPatientId(
        registered.patientId,
        tenantId
      );
      expect(retrievedByPatientId.id).toBe(registered.id);

      // Verify in database
      const dbPatient = await prisma.patient.findUnique({
        where: { id: registered.id },
      });

      expect(dbPatient).toBeDefined();
      expect(dbPatient?.firstName).toBe('John');
      expect(dbPatient?.lastName).toBe('Doe');
      expect(dbPatient?.phone).toBe('+2348012345678');
      expect(dbPatient?.bloodGroup).toBe('O+');
      expect(dbPatient?.allergies).toEqual(['Penicillin', 'Peanuts']);
      expect(dbPatient?.chronicConditions).toEqual(['Hypertension']);
    });

    it('should calculate age correctly from date of birth', async () => {
      // Arrange - Patient born 25 years ago
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 25);

      const dto: RegisterPatientDto = {
        firstName: 'Alice',
        lastName: 'Smith',
        dateOfBirth: birthDate.toISOString().split('T')[0],
        gender: 'FEMALE',
        phone: '+2348099999999',
        consentGiven: true,
      };

      // Act
      const registered = await registerUseCase.execute(dto, tenantId);

      // Assert
      expect(registered.age).toBe(25);
    });

    it('should auto-generate sequential patient IDs', async () => {
      // Arrange - Register multiple patients
      const patients: RegisterPatientDto[] = [
        {
          firstName: 'Patient',
          lastName: 'One',
          dateOfBirth: '1980-01-01',
          gender: 'MALE',
          phone: '+2348011111111',
          consentGiven: true,
        },
        {
          firstName: 'Patient',
          lastName: 'Two',
          dateOfBirth: '1985-01-01',
          gender: 'FEMALE',
          phone: '+2348022222222',
          consentGiven: true,
        },
        {
          firstName: 'Patient',
          lastName: 'Three',
          dateOfBirth: '1990-01-01',
          gender: 'MALE',
          phone: '+2348033333333',
          consentGiven: true,
        },
      ];

      // Act
      const registered = await Promise.all(
        patients.map((dto) => registerUseCase.execute(dto, tenantId))
      );

      // Assert - All have different patient IDs
      const patientIds = registered.map((p) => p.patientId);
      const uniqueIds = new Set(patientIds);
      expect(uniqueIds.size).toBe(3);

      // All follow P000000 format
      patientIds.forEach((id) => {
        expect(id).toMatch(/^P\d{6}$/);
      });
    });
  });

  describe('Registration with Update Flow', () => {
    it('should register patient and then update their information', async () => {
      // Arrange - Initial registration
      const initialDto: RegisterPatientDto = {
        firstName: 'Bob',
        lastName: 'Johnson',
        dateOfBirth: '1975-06-15',
        gender: 'MALE',
        phone: '+2348044444444',
        email: 'bob@example.com',
        consentGiven: true,
      };

      // Act - Register
      const registered = await registerUseCase.execute(initialDto, tenantId);

      // Update patient information
      const updated = await updateUseCase.execute(
        registered.id,
        {
          email: 'bob.johnson@newdomain.com',
          address: '456 New Street, Abuja',
          allergies: ['Aspirin'],
          chronicConditions: ['Diabetes Type 2'],
        },
        tenantId
      );

      // Assert - Updates applied
      expect(updated.email).toBe('bob.johnson@newdomain.com');
      expect(updated.address).toBe('456 New Street, Abuja');
      expect(updated.allergies).toEqual(['Aspirin']);
      expect(updated.chronicConditions).toEqual(['Diabetes Type 2']);
      expect(updated.hasAllergies).toBe(true);

      // Original data unchanged
      expect(updated.firstName).toBe('Bob');
      expect(updated.lastName).toBe('Johnson');
      expect(updated.phone).toBe('+2348044444444');

      // Verify in database
      const dbPatient = await prisma.patient.findUnique({
        where: { id: registered.id },
      });

      expect(dbPatient?.email).toBe('bob.johnson@newdomain.com');
      expect(dbPatient?.address).toBe('456 New Street, Abuja');
      expect(dbPatient?.allergies).toEqual(['Aspirin']);
    });
  });

  describe('Duplicate Prevention', () => {
    it('should prevent duplicate phone numbers within same tenant', async () => {
      // Arrange - Register first patient
      const phone = '+2348055555555';
      const firstDto: RegisterPatientDto = {
        firstName: 'First',
        lastName: 'Patient',
        dateOfBirth: '1980-01-01',
        gender: 'MALE',
        phone,
        consentGiven: true,
      };

      await registerUseCase.execute(firstDto, tenantId);

      // Try to register second patient with same phone
      const duplicateDto: RegisterPatientDto = {
        firstName: 'Second',
        lastName: 'Patient',
        dateOfBirth: '1985-01-01',
        gender: 'FEMALE',
        phone, // Same phone number
        consentGiven: true,
      };

      // Act & Assert
      await expect(registerUseCase.execute(duplicateDto, tenantId)).rejects.toThrow(
        'A patient with this phone number already exists'
      );

      // Verify only one patient with this phone exists
      const patients = await prisma.patient.findMany({
        where: { tenantId, phone },
      });
      expect(patients).toHaveLength(1);
    });

    it('should prevent duplicate phone when updating patient', async () => {
      // Arrange - Register two patients
      const patient1 = await registerUseCase.execute(
        {
          firstName: 'Patient',
          lastName: 'One',
          dateOfBirth: '1980-01-01',
          gender: 'MALE',
          phone: '+2348066666666',
          consentGiven: true,
        },
        tenantId
      );

      const patient2 = await registerUseCase.execute(
        {
          firstName: 'Patient',
          lastName: 'Two',
          dateOfBirth: '1985-01-01',
          gender: 'FEMALE',
          phone: '+2348077777777',
          consentGiven: true,
        },
        tenantId
      );

      // Try to update patient2 with patient1's phone
      await expect(
        updateUseCase.execute(
          patient2.id,
          { phone: '+2348066666666' },
          tenantId
        )
      ).rejects.toThrow('A patient with this phone number already exists');

      // Verify patient2's phone unchanged
      const dbPatient2 = await prisma.patient.findUnique({
        where: { id: patient2.id },
      });
      expect(dbPatient2?.phone).toBe('+2348077777777');
    });
  });

  describe('Tenant Isolation', () => {
    let otherTenantId: string;

    beforeAll(async () => {
      const otherTenant = await createTestTenant(prisma);
      otherTenantId = otherTenant.id;
    });

    afterAll(async () => {
      await cleanDatabase(prisma, otherTenantId);
      await prisma.tenant.delete({ where: { id: otherTenantId } });
    });

    it('should allow same phone number in different tenants', async () => {
      // Arrange
      const sharedPhone = '+2348088888888';
      const dto: RegisterPatientDto = {
        firstName: 'Tenant',
        lastName: 'Test',
        dateOfBirth: '1990-01-01',
        gender: 'MALE',
        phone: sharedPhone,
        consentGiven: true,
      };

      // Act - Register in both tenants
      const patient1 = await registerUseCase.execute(dto, tenantId);
      const patient2 = await registerUseCase.execute(
        { ...dto, firstName: 'Different' },
        otherTenantId
      );

      // Assert - Both registrations successful
      expect(patient1.id).toBeDefined();
      expect(patient2.id).toBeDefined();
      expect(patient1.id).not.toBe(patient2.id);
      expect(patient1.phone).toBe(sharedPhone);
      expect(patient2.phone).toBe(sharedPhone);

      // Verify in database
      const allWithPhone = await prisma.patient.findMany({
        where: { phone: sharedPhone },
      });
      expect(allWithPhone).toHaveLength(2);
    });

    it('should not retrieve patients from other tenants', async () => {
      // Arrange - Register patient in otherTenant
      const dto: RegisterPatientDto = {
        firstName: 'Other',
        lastName: 'Tenant',
        dateOfBirth: '1990-01-01',
        gender: 'MALE',
        phone: '+2348099999000',
        consentGiven: true,
      };

      const otherPatient = await registerUseCase.execute(dto, otherTenantId);

      // Act & Assert - Try to retrieve from wrong tenant
      await expect(
        getUseCase.executeById(otherPatient.id, tenantId)
      ).rejects.toThrow('Patient');

      await expect(
        getUseCase.executeByPatientId(otherPatient.patientId, tenantId)
      ).rejects.toThrow('Patient');
    });
  });

  describe('Data Integrity', () => {
    it('should store emergency contact information correctly', async () => {
      // Arrange
      const dto: RegisterPatientDto = {
        firstName: 'Emergency',
        lastName: 'Test',
        dateOfBirth: '1980-01-01',
        gender: 'MALE',
        phone: '+2348088800000',
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Mother',
          phone: '+2348088800001',
        },
        consentGiven: true,
      };

      // Act
      const registered = await registerUseCase.execute(dto, tenantId);

      // Assert
      expect(registered.emergencyContact).toEqual({
        name: 'Emergency Contact',
        relationship: 'Mother',
        phone: '+2348088800001',
      });

      // Verify JSON storage in database
      const dbPatient = await prisma.patient.findUnique({
        where: { id: registered.id },
      });

      expect(dbPatient?.emergencyContact).toBeDefined();
      expect(typeof dbPatient?.emergencyContact).toBe('object');
    });

    it('should handle minimal registration (only required fields)', async () => {
      // Arrange - Only required fields
      const minimalDto: RegisterPatientDto = {
        firstName: 'Minimal',
        lastName: 'Patient',
        dateOfBirth: '1990-01-01',
        gender: 'FEMALE',
        phone: '+2348077700000',
        consentGiven: true,
      };

      // Act
      const registered = await registerUseCase.execute(minimalDto, tenantId);

      // Assert - Optional fields are null/empty
      expect(registered.email).toBeNull();
      expect(registered.address).toBeNull();
      expect(registered.bloodGroup).toBeNull();
      expect(registered.allergies).toEqual([]);
      expect(registered.chronicConditions).toEqual([]);
      expect(registered.emergencyContact).toBeNull();
      expect(registered.hasAllergies).toBe(false);

      // Required fields present
      expect(registered.firstName).toBe('Minimal');
      expect(registered.lastName).toBe('Patient');
      expect(registered.phone).toBe('+2348077700000');
      expect(registered.consentGiven).toBe(true);
    });
  });
});
