/**
 * Get FHIR Condition Use Case Tests
 *
 * Covers the ConsultationDiagnosis -> FHIR R4 Condition mapping, including
 * the ICD-10/ICD-11 system URI selection and the certainty -> verification
 * status translation.
 */

import { GetFhirConditionUseCase } from './get-fhir-condition.use-case';

describe('GetFhirConditionUseCase', () => {
  let useCase: GetFhirConditionUseCase;
  let mockPrisma: any;

  const recordId = 'consultation-diagnosis-uuid-1';
  const tenantId = 'tenant-1';

  const baseRecord = {
    id: recordId,
    tenantId,
    isPrimary: true,
    certainty: 'CONFIRMED',
    consultation: { patientId: 'patient-uuid-1' },
    diagnosis: { code: '1A00', name: 'Cholera', type: 'ICD-11' },
  };

  beforeEach(() => {
    mockPrisma = {
      consultationDiagnosis: {
        findFirst: jest.fn(),
      },
      diagnosisCodeMapping: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    useCase = new GetFhirConditionUseCase(mockPrisma);
  });

  it('should query the diagnosis record scoped by id and tenantId, joining consultation and diagnosis', async () => {
    mockPrisma.consultationDiagnosis.findFirst.mockResolvedValue(baseRecord);

    await useCase.execute(recordId, tenantId);

    expect(mockPrisma.consultationDiagnosis.findFirst).toHaveBeenCalledWith({
      where: { id: recordId, tenantId },
      include: {
        consultation: { select: { patientId: true } },
        diagnosis: { select: { code: true, name: true, type: true } },
      },
    });
  });

  it('should map a primary confirmed ICD-11 diagnosis into a Condition', async () => {
    mockPrisma.consultationDiagnosis.findFirst.mockResolvedValue(baseRecord);

    const result = await useCase.execute(recordId, tenantId);

    expect(result).toEqual({
      resourceType: 'Condition',
      id: recordId,
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
      },
      verificationStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }],
      },
      category: [
        {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }],
        },
      ],
      code: {
        coding: [{ system: 'http://id.who.int/icd/release/11/mms', code: '1A00', display: 'Cholera' }],
        text: 'Cholera',
      },
      subject: { reference: 'Patient/patient-uuid-1' },
    });
  });

  it('should use the ICD-10 system URI for an ICD-10-typed diagnosis', async () => {
    mockPrisma.consultationDiagnosis.findFirst.mockResolvedValue({
      ...baseRecord,
      diagnosis: { code: 'A00', name: 'Cholera', type: 'ICD-10' },
    });

    const result = await useCase.execute(recordId, tenantId);

    expect(result.code?.coding?.[0].system).toBe('http://hl7.org/fhir/sid/icd-10');
  });

  it('should mark a non-primary diagnosis as problem-list-item', async () => {
    mockPrisma.consultationDiagnosis.findFirst.mockResolvedValue({ ...baseRecord, isPrimary: false });

    const result = await useCase.execute(recordId, tenantId);

    expect(result.category?.[0].coding?.[0].code).toBe('problem-list-item');
  });

  it.each([
    ['PROVISIONAL', 'provisional'],
    ['DIFFERENTIAL', 'differential'],
    ['RULED_OUT', 'refuted'],
  ])('should map certainty %s to verification status %s', async (certainty, expectedStatus) => {
    mockPrisma.consultationDiagnosis.findFirst.mockResolvedValue({ ...baseRecord, certainty });

    const result = await useCase.execute(recordId, tenantId);

    expect(result.verificationStatus?.coding?.[0].code).toBe(expectedStatus);
  });

  it('should throw when the diagnosis record does not exist for the tenant', async () => {
    mockPrisma.consultationDiagnosis.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(recordId, tenantId)).rejects.toThrow('Diagnosis record not found');
  });

  describe('resolved code mapping', () => {
    it('appends a resolved ICD-10 equivalent coding alongside the primary ICD-11 coding', async () => {
      mockPrisma.consultationDiagnosis.findFirst.mockResolvedValue(baseRecord);
      mockPrisma.diagnosisCodeMapping.findMany.mockResolvedValue([
        { id: 'm1', sourceSystem: 'ICD-11', sourceCode: '1A00', targetSystem: 'ICD-10', targetCode: 'A00', mapKind: 'EXACT', note: 'Cholera' },
      ]);

      const result = await useCase.execute(recordId, tenantId);

      expect(mockPrisma.diagnosisCodeMapping.findMany).toHaveBeenCalledWith({
        where: { sourceSystem: 'ICD-11', sourceCode: '1A00' },
      });
      expect(result.code?.coding).toEqual([
        { system: 'http://id.who.int/icd/release/11/mms', code: '1A00', display: 'Cholera' },
        { system: 'http://hl7.org/fhir/sid/icd-10', code: 'A00', display: 'Cholera' },
      ]);
    });

    it('appends every coding for a one-to-many mapping', async () => {
      mockPrisma.consultationDiagnosis.findFirst.mockResolvedValue(baseRecord);
      mockPrisma.diagnosisCodeMapping.findMany.mockResolvedValue([
        { id: 'm1', sourceSystem: 'ICD-11', sourceCode: '1A00', targetSystem: 'ICD-10', targetCode: 'A00', mapKind: 'ONE_TO_MANY', note: 'Cholera due to X' },
        { id: 'm2', sourceSystem: 'ICD-11', sourceCode: '1A00', targetSystem: 'ICD-10', targetCode: 'A001', mapKind: 'ONE_TO_MANY', note: 'Cholera due to Y' },
      ]);

      const result = await useCase.execute(recordId, tenantId);

      expect(result.code?.coding).toHaveLength(3);
    });

    it('adds no additional coding when no mapping exists — unchanged single-coding behavior', async () => {
      mockPrisma.consultationDiagnosis.findFirst.mockResolvedValue(baseRecord);
      mockPrisma.diagnosisCodeMapping.findMany.mockResolvedValue([]);

      const result = await useCase.execute(recordId, tenantId);

      expect(result.code?.coding).toHaveLength(1);
    });
  });
});
