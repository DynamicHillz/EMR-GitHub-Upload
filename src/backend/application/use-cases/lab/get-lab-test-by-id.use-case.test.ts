/**
 * Get Lab Test By Id Use Case Tests
 */

import { GetLabTestByIdUseCase } from './get-lab-test-by-id.use-case';

// Mirrors the private calculateAge() in the use case so expected age can be
// derived deterministically regardless of the day this test happens to run.
function expectedAge(dateOfBirth: Date): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

describe('GetLabTestByIdUseCase', () => {
  let useCase: GetLabTestByIdUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const labTestId = 'record-1';
  const dob = new Date('1990-05-15');

  function baseRecord(overrides: any = {}) {
    return {
      id: labTestId,
      orderId: 'order-1',
      status: 'COMPLETED',
      accessionNumber: 'ACC-1',
      unitPrice: 500,
      specimenType: 'Blood',
      specimenQuality: 'GOOD',
      collectedAt: new Date('2026-07-01T10:00:00.000Z'),
      rejectionReason: null,
      reviewNotes: 'looks fine',
      reviewedById: null,
      reviewedAt: null,
      createdAt: new Date('2026-07-01T09:00:00.000Z'),
      updatedAt: new Date('2026-07-01T09:30:00.000Z'),
      order: {
        patientId: 'patient-1',
        orderedById: 'doctor-1',
        consultationId: 'consult-1',
        clinicalNotes: 'rule out anemia',
        urgency: 'ROUTINE',
        patient: {
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: dob,
          gender: 'FEMALE',
          allergies: ['Penicillin'],
          chronicConditions: ['Diabetes'],
        },
        orderedBy: { firstName: 'John', lastName: 'Smith' },
      },
      test: {
        name: 'CBC',
        loincCode: null,
        category: 'Hematology',
        parameters: [
          {
            parameter: {
              name: 'Hemoglobin',
              loincCode: 'LOINC-1',
              unit: 'g/dL',
              refRangeMale: '13-17',
              refRangeFemale: '12-15',
            },
          },
        ],
      },
      resultValues: [],
      reviewedBy: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    mockPrisma = {
      labTestRecord: {
        findFirst: jest.fn(),
      },
    };

    useCase = new GetLabTestByIdUseCase(mockPrisma);
  });

  it('should throw when the lab test record does not exist in this tenant', async () => {
    mockPrisma.labTestRecord.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(labTestId, tenantId)).rejects.toThrow('Lab test not found');
    expect(mockPrisma.labTestRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: labTestId, tenantId } })
    );
  });

  it('should build result rows from test.parameters (using the female reference range) when there are no resultValues yet', async () => {
    const record = baseRecord();
    mockPrisma.labTestRecord.findFirst.mockResolvedValue(record);

    const result = await useCase.execute(labTestId, tenantId);

    expect(result.results).toEqual([
      {
        parameter: 'Hemoglobin',
        loincCode: 'LOINC-1',
        value: '',
        unit: 'g/dL',
        jsonValue: null,
        hasDeltaAlert: false,
        deltaAlertNotes: null,
        referenceMin: 12,
        referenceMax: 15,
        referenceRange: '12-15',
      },
    ]);
    expect(result.abnormalFlags).toBeNull();
    expect(result.patientAge).toBe(expectedAge(dob));
    expect(result.patientName).toBe('Jane Doe');
    expect(result.testCode).toBe('CBC'); // falls back to name when loincCode is null
    expect(result.orderedByName).toBe('John Smith');
    expect(result.reviewedByName).toBeNull();
  });

  it('should build result rows from resultValues (using the male reference range) when present, and surface abnormal flags', async () => {
    const record = baseRecord({
      order: {
        ...baseRecord().order,
        patient: { ...baseRecord().order.patient, gender: 'MALE' },
      },
      resultValues: [
        {
          parameter: {
            name: 'Hemoglobin',
            loincCode: 'LOINC-1',
            unit: 'g/dL',
            refRangeMale: '13-17',
            refRangeFemale: '12-15',
          },
          textValue: null,
          numericValue: 20,
          jsonValue: null,
          hasDeltaAlert: true,
          deltaAlertNotes: 'Delta Check: big change',
          isAbnormal: true,
          flagType: 'CRITICAL_HIGH',
        },
      ],
      reviewedById: 'doctor-2',
      reviewedAt: new Date('2026-07-02T10:00:00.000Z'),
      reviewedBy: { firstName: 'Alice', lastName: 'Reviewer' },
    });
    mockPrisma.labTestRecord.findFirst.mockResolvedValue(record);

    const result = await useCase.execute(labTestId, tenantId);

    expect(result.results).toEqual([
      {
        parameter: 'Hemoglobin',
        loincCode: 'LOINC-1',
        value: '20',
        unit: 'g/dL',
        jsonValue: null,
        hasDeltaAlert: true,
        deltaAlertNotes: 'Delta Check: big change',
        referenceMin: 13,
        referenceMax: 17,
        referenceRange: '13-17',
        severity: 'CRITICAL_HIGH',
      },
    ]);
    expect(result.abnormalFlags).toEqual([
      {
        parameter: 'Hemoglobin',
        value: '20',
        referenceRange: '13-17',
        severity: 'CRITICAL_HIGH',
      },
    ]);
    expect(result.reviewedByName).toBe('Alice Reviewer');
    expect(result.reviewedAt).toBe('2026-07-02T10:00:00.000Z');
  });

  it('should use textValue over numericValue when both could apply, and default severity to ABNORMAL when flagType is missing', async () => {
    const record = baseRecord({
      resultValues: [
        {
          parameter: {
            name: 'Hemoglobin',
            loincCode: null,
            unit: 'g/dL',
            refRangeMale: '13-17',
            refRangeFemale: '12-15',
          },
          textValue: 'Positive',
          numericValue: null,
          jsonValue: null,
          hasDeltaAlert: false,
          deltaAlertNotes: null,
          isAbnormal: true,
          flagType: null,
        },
      ],
    });
    mockPrisma.labTestRecord.findFirst.mockResolvedValue(record);

    const result = await useCase.execute(labTestId, tenantId);

    expect(result.results[0].value).toBe('Positive');
    expect(result.abnormalFlags[0].severity).toBe('ABNORMAL');
  });

  it('should fall back to testCode = testName when loincCode is null on the test itself', async () => {
    const record = baseRecord();
    mockPrisma.labTestRecord.findFirst.mockResolvedValue(record);

    const result = await useCase.execute(labTestId, tenantId);

    expect(result.testCode).toBe(record.test.name);
  });

  it('should use the real loincCode as testCode when present', async () => {
    const record = baseRecord({ test: { ...baseRecord().test, loincCode: 'CBC-CODE' } });
    mockPrisma.labTestRecord.findFirst.mockResolvedValue(record);

    const result = await useCase.execute(labTestId, tenantId);

    expect(result.testCode).toBe('CBC-CODE');
  });
});
