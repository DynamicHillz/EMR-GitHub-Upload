/**
 * Get FHIR Patient $everything Use Case Tests
 *
 * This composes every other FHIR mapper into one Bundle — the tests here
 * focus on correct aggregation (right counts, right resource types) since
 * the field-level mapping correctness is already covered by each
 * individual resource's own test file.
 */

import { GetFhirPatientEverythingUseCase } from './get-fhir-patient-everything.use-case';

describe('GetFhirPatientEverythingUseCase', () => {
  let useCase: GetFhirPatientEverythingUseCase;
  let mockPrisma: any;

  const patientId = 'patient-uuid-1';
  const tenantId = 'tenant-1';

  const basePatient = {
    id: patientId,
    tenantId,
    patientId: 'PT-0001',
    status: 'ACTIVE',
    firstName: 'Jane',
    lastName: 'Doe',
    gender: 'FEMALE',
    dateOfBirth: new Date('1990-05-15T00:00:00.000Z'),
  };

  const consultation = {
    id: 'consultation-1',
    tenantId,
    patientId,
    doctorId: 'doctor-1',
    status: 'COMPLETED',
    createdAt: new Date('2026-01-10T09:00:00.000Z'),
    updatedAt: new Date('2026-01-10T09:30:00.000Z'),
    heartRate: 78,
    temperature: 37.0,
    systolicBP: null,
    diastolicBP: null,
    weight: null,
    height: null,
    spO2: null,
  };

  beforeEach(() => {
    mockPrisma = {
      patient: { findFirst: jest.fn() },
      consultation: { findMany: jest.fn().mockResolvedValue([]) },
      consultationDiagnosis: { findMany: jest.fn().mockResolvedValue([]) },
      labResultValue: { findMany: jest.fn().mockResolvedValue([]) },
      prescription: { findMany: jest.fn().mockResolvedValue([]) },
      labTestRecord: { findMany: jest.fn().mockResolvedValue([]) },
    };

    useCase = new GetFhirPatientEverythingUseCase(mockPrisma);
  });

  it('should throw when the patient does not exist for the tenant', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(patientId, tenantId)).rejects.toThrow('Patient not found');
  });

  it('should return a Bundle containing only the Patient when there is no other clinical data', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(basePatient);

    const result = await useCase.execute(patientId, tenantId);

    expect(result.resourceType).toBe('Bundle');
    expect(result.type).toBe('searchset');
    expect(result.total).toBe(1);
    expect(result.entry?.[0].resource?.resourceType).toBe('Patient');
  });

  it('should include one Encounter plus one Observation per non-null vital for each consultation', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
    mockPrisma.consultation.findMany.mockResolvedValue([consultation]);

    const result = await useCase.execute(patientId, tenantId);

    const types = result.entry!.map(e => e.resource!.resourceType);
    // Patient + Encounter + 2 vitals (heartRate, temperature are non-null on the fixture)
    expect(result.total).toBe(4);
    expect(types.filter(t => t === 'Encounter')).toHaveLength(1);
    expect(types.filter(t => t === 'Observation')).toHaveLength(2);
  });

  it('should include a Condition for each consultation diagnosis', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
    mockPrisma.consultationDiagnosis.findMany.mockResolvedValue([
      {
        id: 'diag-1',
        isPrimary: true,
        certainty: 'CONFIRMED',
        consultation: { patientId },
        diagnosis: { code: '1A00', name: 'Cholera', type: 'ICD-11' },
      },
    ]);

    const result = await useCase.execute(patientId, tenantId);

    expect(mockPrisma.consultationDiagnosis.findMany).toHaveBeenCalledWith({
      where: { tenantId, consultation: { patientId, tenantId } },
      include: {
        consultation: { select: { patientId: true } },
        diagnosis: { select: { code: true, name: true, type: true } },
      },
    });
    const types = result.entry!.map(e => e.resource!.resourceType);
    expect(types.filter(t => t === 'Condition')).toHaveLength(1);
  });

  it('should include a MedicationRequest for each prescription and a DiagnosticReport for each lab test record', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
    mockPrisma.prescription.findMany.mockResolvedValue([
      {
        id: 'rx-1',
        patientId,
        doctorId: 'doctor-1',
        status: 'PENDING',
        medicationName: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'BID',
        duration: '7 days',
        instructions: null,
        createdAt: new Date('2026-01-11T00:00:00.000Z'),
      },
    ]);
    mockPrisma.labTestRecord.findMany.mockResolvedValue([
      {
        id: 'ltr-1',
        status: 'COMPLETED',
        createdAt: new Date('2026-01-12T00:00:00.000Z'),
        reportGeneratedAt: null,
        order: { patientId },
        test: { name: 'FBC', loincCode: null },
        resultValues: [],
      },
    ]);

    const result = await useCase.execute(patientId, tenantId);

    const types = result.entry!.map(e => e.resource!.resourceType);
    expect(types.filter(t => t === 'MedicationRequest')).toHaveLength(1);
    expect(types.filter(t => t === 'DiagnosticReport')).toHaveLength(1);
  });

  it('should give every entry a fullUrl matching its resource type and id', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(basePatient);

    const result = await useCase.execute(patientId, tenantId);

    expect(result.entry?.[0].fullUrl).toBe(`Patient/${patientId}`);
  });
});
