/**
 * Get FHIR DiagnosticReport Use Case Tests
 *
 * Covers the LabTestRecord -> FHIR R4 DiagnosticReport mapping, including
 * the status translation and that it correctly references the Observations
 * produced for its result values (reusing the Observation mapping, not
 * duplicating it).
 */

import { GetFhirDiagnosticReportUseCase } from './get-fhir-diagnostic-report.use-case';

describe('GetFhirDiagnosticReportUseCase', () => {
  let useCase: GetFhirDiagnosticReportUseCase;
  let mockPrisma: any;

  const recordId = 'lab-test-record-uuid-1';
  const tenantId = 'tenant-1';

  const baseRecord = {
    id: recordId,
    tenantId,
    status: 'COMPLETED',
    createdAt: new Date('2026-01-12T08:00:00.000Z'),
    reportGeneratedAt: new Date('2026-01-12T10:30:00.000Z'),
    order: { patientId: 'patient-uuid-1' },
    test: { name: 'Full Blood Count', loincCode: '58410-2' },
    resultValues: [{ id: 'result-1' }, { id: 'result-2' }],
  };

  beforeEach(() => {
    mockPrisma = {
      labTestRecord: { findFirst: jest.fn() },
    };

    useCase = new GetFhirDiagnosticReportUseCase(mockPrisma);
  });

  it('should query the lab test record scoped by id and tenantId, including order/test/resultValues', async () => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue(baseRecord);

    await useCase.execute(recordId, tenantId);

    expect(mockPrisma.labTestRecord.findFirst).toHaveBeenCalledWith({
      where: { id: recordId, tenantId },
      include: {
        order: { select: { patientId: true } },
        test: { select: { name: true, loincCode: true } },
        resultValues: { select: { id: true } },
      },
    });
  });

  it('should map a completed record into a final DiagnosticReport referencing its Observations', async () => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue(baseRecord);

    const result = await useCase.execute(recordId, tenantId);

    expect(result).toEqual({
      resourceType: 'DiagnosticReport',
      id: recordId,
      status: 'final',
      category: [
        { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB', display: 'Laboratory' }] },
      ],
      code: {
        coding: [{ system: 'http://loinc.org', code: '58410-2', display: 'Full Blood Count' }],
        text: 'Full Blood Count',
      },
      subject: { reference: 'Patient/patient-uuid-1' },
      effectiveDateTime: '2026-01-12T08:00:00.000Z',
      issued: '2026-01-12T10:30:00.000Z',
      result: [{ reference: 'Observation/result-1' }, { reference: 'Observation/result-2' }],
    });
  });

  it('should omit issued when reportGeneratedAt is not set', async () => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue({ ...baseRecord, reportGeneratedAt: null });

    const result = await useCase.execute(recordId, tenantId);

    expect(result.issued).toBeUndefined();
  });

  it('should fall back to a local code system when the test has no loincCode', async () => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue({
      ...baseRecord,
      test: { name: 'Custom Panel', loincCode: null },
    });

    const result = await useCase.execute(recordId, tenantId);

    expect(result.code?.coding?.[0]).toEqual({
      system: 'http://ststephen-emr.local/lab-test',
      code: 'Custom Panel',
      display: 'Custom Panel',
    });
  });

  it.each([
    ['PENDING', 'registered'],
    ['IN_PROGRESS', 'partial'],
    ['REVIEWED', 'final'],
    ['CANCELLED', 'cancelled'],
    ['REJECTED', 'cancelled'],
  ])('should map status %s to FHIR status %s', async (status, expected) => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue({ ...baseRecord, status });

    const result = await useCase.execute(recordId, tenantId);

    expect(result.status).toBe(expected);
  });

  it('should throw when the lab test record does not exist for the tenant', async () => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(recordId, tenantId)).rejects.toThrow('Lab test record not found');
  });
});
