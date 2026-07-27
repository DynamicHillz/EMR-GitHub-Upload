/**
 * Get FHIR Patient Use Case Tests
 *
 * Covers the internal Patient -> FHIR R4 Patient resource mapping,
 * since a mapping bug here would silently corrupt exported records.
 */

import { GetFhirPatientUseCase } from './get-fhir-patient.use-case';

describe('GetFhirPatientUseCase', () => {
  let useCase: GetFhirPatientUseCase;
  let mockPrisma: any;

  const patientId = 'patient-uuid-1';
  const tenantId = 'tenant-1';

  const basePatient = {
    id: patientId,
    patientId: 'PT-0001',
    tenantId,
    status: 'ACTIVE',
    firstName: 'Jane',
    lastName: 'Doe',
    gender: 'FEMALE',
    dateOfBirth: new Date('1990-05-15T00:00:00.000Z'),
    phone: '+2348012345678',
    email: 'jane.doe@example.com',
    address: '12 Clinic Road',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    fhirId: null,
  };

  beforeEach(() => {
    mockPrisma = {
      patient: {
        findFirst: jest.fn(),
      },
    };

    useCase = new GetFhirPatientUseCase(mockPrisma);
  });

  it('should query the patient scoped by id and tenantId', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(basePatient);

    await useCase.execute(patientId, tenantId);

    expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith({
      where: { id: patientId, tenantId },
    });
  });

  it('should map a fully populated patient into a FHIR R4 Patient resource', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(basePatient);

    const result = await useCase.execute(patientId, tenantId);

    expect(result).toEqual({
      resourceType: 'Patient',
      id: patientId,
      identifier: [
        {
          use: 'usual',
          system: 'http://ststephen-emr.local/patient-id',
          value: 'PT-0001',
        },
      ],
      active: true,
      name: [
        {
          use: 'official',
          family: 'Doe',
          given: ['Jane'],
        },
      ],
      telecom: [
        { system: 'phone', value: '+2348012345678', use: 'mobile' },
        { system: 'email', value: 'jane.doe@example.com', use: 'home' },
      ],
      gender: 'female',
      birthDate: '1990-05-15',
      address: [
        {
          use: 'home',
          text: '12 Clinic Road',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria',
        },
      ],
    });
  });

  it('should use the fhirId as the resource id when present', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ ...basePatient, fhirId: 'fhir-external-id-1' });

    const result = await useCase.execute(patientId, tenantId);

    expect(result.id).toBe('fhir-external-id-1');
  });

  it('should mark the patient inactive when status is not ACTIVE', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ ...basePatient, status: 'INACTIVE' });

    const result = await useCase.execute(patientId, tenantId);

    expect(result.active).toBe(false);
  });

  it('should map MALE gender to "male"', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ ...basePatient, gender: 'MALE' });

    const result = await useCase.execute(patientId, tenantId);

    expect(result.gender).toBe('male');
  });

  it('should map any other gender value to "unknown"', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ ...basePatient, gender: 'OTHER' });

    const result = await useCase.execute(patientId, tenantId);

    expect(result.gender).toBe('unknown');
  });

  it('should return an empty telecom array when the patient has no phone or email', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ ...basePatient, phone: null, email: null });

    const result = await useCase.execute(patientId, tenantId);

    expect(result.telecom).toEqual([]);
  });

  it('should return an empty address array when the patient has no address', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ ...basePatient, address: null });

    const result = await useCase.execute(patientId, tenantId);

    expect(result.address).toEqual([]);
  });

  it('should throw when the patient does not exist for the tenant', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(patientId, tenantId)).rejects.toThrow('Patient not found');
  });
});
