/**
 * Get FHIR Observation Use Case Tests
 *
 * Covers both real sources this Observation type is built from: vitals
 * (scalar Consultation fields, synthesized into individual Observations)
 * and lab results (LabResultValue rows) — including the loincCode-present
 * vs absent branch, which decides whether the code system is real LOINC
 * or a local fallback.
 */

import { GetFhirObservationUseCase, vitalObservationId } from './get-fhir-observation.use-case';

describe('GetFhirObservationUseCase', () => {
  let useCase: GetFhirObservationUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const consultationId = 'consultation-uuid-1';

  const baseConsultation = {
    id: consultationId,
    tenantId,
    patientId: 'patient-uuid-1',
    createdAt: new Date('2026-01-10T09:00:00.000Z'),
    heartRate: 78,
    temperature: null,
    systolicBP: null,
    diastolicBP: null,
    weight: null,
    height: null,
    spO2: null,
  };

  beforeEach(() => {
    mockPrisma = {
      consultation: { findFirst: jest.fn() },
      labResultValue: { findFirst: jest.fn() },
    };

    useCase = new GetFhirObservationUseCase(mockPrisma);
  });

  describe('vitals', () => {
    it('should map a heart-rate vital into a vital-signs Observation with a LOINC code', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(baseConsultation);

      const id = vitalObservationId(consultationId, '8867-4');
      const result = await useCase.execute(id, tenantId);

      expect(mockPrisma.consultation.findFirst).toHaveBeenCalledWith({
        where: { id: consultationId, tenantId },
      });
      expect(result).toEqual({
        resourceType: 'Observation',
        id,
        status: 'final',
        category: [
          {
            coding: [
              { system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' },
            ],
          },
        ],
        code: {
          coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }],
          text: 'Heart rate',
        },
        subject: { reference: 'Patient/patient-uuid-1' },
        encounter: { reference: `Encounter/${consultationId}` },
        effectiveDateTime: '2026-01-10T09:00:00.000Z',
        valueQuantity: { value: 78, unit: 'beats/minute', system: 'http://unitsofmeasure.org', code: '/min' },
      });
    });

    it('should throw when the vital field is null on the consultation', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue({ ...baseConsultation, heartRate: null });

      const id = vitalObservationId(consultationId, '8867-4');
      await expect(useCase.execute(id, tenantId)).rejects.toThrow('Observation not found');
    });

    it('should throw when the consultation does not exist for the tenant', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(null);

      const id = vitalObservationId(consultationId, '8867-4');
      await expect(useCase.execute(id, tenantId)).rejects.toThrow('Observation not found');
    });

    it('should throw when the vitals id does not match any known LOINC code', async () => {
      await expect(useCase.execute('vitals-consultation-uuid-1-9999-9', tenantId)).rejects.toThrow('Observation not found');
      expect(mockPrisma.consultation.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('lab results', () => {
    const baseResultValue = {
      id: 'lab-result-uuid-1',
      tenantId,
      numericValue: 14.2,
      textValue: null,
      isAbnormal: false,
      flagType: null,
      enteredAt: new Date('2026-01-12T10:00:00.000Z'),
      testRecord: { order: { id: 'order-uuid-1', patientId: 'patient-uuid-1' } },
      parameter: { name: 'Hemoglobin', unit: 'g/dL', loincCode: '718-7' },
    };

    it('should query the result value scoped by id and tenantId, including testRecord.order and parameter', async () => {
      mockPrisma.labResultValue.findFirst.mockResolvedValue(baseResultValue);

      await useCase.execute('lab-result-uuid-1', tenantId);

      expect(mockPrisma.labResultValue.findFirst).toHaveBeenCalledWith({
        where: { id: 'lab-result-uuid-1', tenantId },
        include: {
          testRecord: { include: { order: { select: { id: true, patientId: true } } } },
          parameter: { select: { name: true, unit: true, loincCode: true } },
        },
      });
    });

    it('should map a normal numeric lab result with a real LOINC code', async () => {
      mockPrisma.labResultValue.findFirst.mockResolvedValue(baseResultValue);

      const result = await useCase.execute('lab-result-uuid-1', tenantId);

      expect(result.code).toEqual({
        coding: [{ system: 'http://loinc.org', code: '718-7', display: 'Hemoglobin' }],
        text: 'Hemoglobin',
      });
      expect(result.valueQuantity).toEqual({ value: 14.2, unit: 'g/dL' });
      expect(result.interpretation?.[0].coding?.[0].code).toBe('N');
    });

    it('should fall back to a local code system when loincCode is not set', async () => {
      mockPrisma.labResultValue.findFirst.mockResolvedValue({
        ...baseResultValue,
        parameter: { name: 'Custom Panel Marker', unit: 'U/L', loincCode: null },
      });

      const result = await useCase.execute('lab-result-uuid-1', tenantId);

      expect(result.code?.coding?.[0]).toEqual({
        system: 'http://ststephen-emr.local/lab-parameter',
        code: 'Custom Panel Marker',
        display: 'Custom Panel Marker',
      });
    });

    it('should use valueString for a non-numeric (text/microbiology) result', async () => {
      mockPrisma.labResultValue.findFirst.mockResolvedValue({
        ...baseResultValue,
        numericValue: null,
        textValue: 'No growth after 48 hours',
      });

      const result = await useCase.execute('lab-result-uuid-1', tenantId);

      expect(result.valueString).toBe('No growth after 48 hours');
      expect(result.valueQuantity).toBeUndefined();
    });

    it.each([
      ['HIGH', 'H'],
      ['LOW', 'L'],
      ['CRITICAL_HIGH', 'HH'],
      ['CRITICAL_LOW', 'LL'],
      ['ABNORMAL', 'A'],
    ])('should map flagType %s to interpretation code %s', async (flagType, expectedCode) => {
      mockPrisma.labResultValue.findFirst.mockResolvedValue({ ...baseResultValue, isAbnormal: true, flagType });

      const result = await useCase.execute('lab-result-uuid-1', tenantId);

      expect(result.interpretation?.[0].coding?.[0].code).toBe(expectedCode);
    });

    it('should throw when the result value does not exist for the tenant', async () => {
      mockPrisma.labResultValue.findFirst.mockResolvedValue(null);

      await expect(useCase.execute('lab-result-uuid-1', tenantId)).rejects.toThrow('Observation not found');
    });
  });
});
