/**
 * Get NHMIS Monthly Return Report Use Case Tests
 *
 * Covers: age-group x sex attendance bucketing, the new-vs-repeat
 * classification (the least obvious computation — derived from consultation
 * history, not a stored field), top-conditions tally/sort/slice scoped to
 * ConsultationDiagnosis only, and empty-month behavior.
 */

import { GetNhmisMonthlyReturnReportUseCase } from './get-nhmis-monthly-return-report.use-case';

describe('GetNhmisMonthlyReturnReportUseCase', () => {
  let useCase: GetNhmisMonthlyReturnReportUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const month = 6;
  const year = 2026;

  beforeEach(() => {
    mockPrisma = {
      consultation: { findMany: jest.fn() },
      consultationDiagnosis: { findMany: jest.fn().mockResolvedValue([]) },
    };
    useCase = new GetNhmisMonthlyReturnReportUseCase(mockPrisma);
  });

  it('queries completed consultations within the exact month range', async () => {
    mockPrisma.consultation.findMany.mockResolvedValueOnce([]);

    await useCase.execute(tenantId, month, year);

    expect(mockPrisma.consultation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId,
          consultationDate: { gte: new Date(2026, 5, 1), lte: new Date(2026, 6, 0, 23, 59, 59, 999) },
          status: 'COMPLETED',
        },
      })
    );
  });

  it('does not query prior-year history when there are no consultations this month', async () => {
    mockPrisma.consultation.findMany.mockResolvedValueOnce([]);

    await useCase.execute(tenantId, month, year);

    expect(mockPrisma.consultation.findMany).toHaveBeenCalledTimes(1);
  });

  it('reports an all-zero attendance grid for an empty month, not an error', async () => {
    mockPrisma.consultation.findMany.mockResolvedValueOnce([]);

    const result = await useCase.execute(tenantId, month, year);

    expect(result.attendance.grandTotal).toBe(0);
    expect(result.attendance.byAgeGroupAndSex).toHaveLength(6); // every NHMIS_AGE_GROUPS band present at zero
    expect(result.attendance.byAgeGroupAndSex.every((row) => row.newMale + row.newFemale + row.repeatMale + row.repeatFemale === 0)).toBe(true);
  });

  it('classifies a patient with no earlier consultation this year as new, bucketed by age group and sex', async () => {
    mockPrisma.consultation.findMany
      .mockResolvedValueOnce([
        { patientId: 'p1', consultationDate: new Date(2026, 5, 15), patient: { dateOfBirth: new Date(2023, 0, 1), gender: 'MALE' } },
      ])
      .mockResolvedValueOnce([]); // no prior-year history for p1

    const result = await useCase.execute(tenantId, month, year);

    expect(result.attendance.totalNew).toBe(1);
    expect(result.attendance.totalRepeat).toBe(0);
    const row = result.attendance.byAgeGroupAndSex.find((r) => r.ageGroup === '1-4')!;
    expect(row.newMale).toBe(1);
    expect(row.newFemale).toBe(0);
  });

  it('classifies a patient with an earlier same-year consultation as repeat', async () => {
    mockPrisma.consultation.findMany
      .mockResolvedValueOnce([
        { patientId: 'p2', consultationDate: new Date(2026, 5, 15), patient: { dateOfBirth: new Date(1990, 0, 1), gender: 'FEMALE' } },
      ])
      .mockResolvedValueOnce([{ patientId: 'p2' }]); // earlier consultation this year

    const result = await useCase.execute(tenantId, month, year);

    expect(result.attendance.totalNew).toBe(0);
    expect(result.attendance.totalRepeat).toBe(1);
    const row = result.attendance.byAgeGroupAndSex.find((r) => r.ageGroup === '20-49')!;
    expect(row.repeatFemale).toBe(1);
    expect(row.repeatMale).toBe(0);
  });

  it('queries prior history only for patients in the current month range in the same calendar year', async () => {
    mockPrisma.consultation.findMany
      .mockResolvedValueOnce([
        { patientId: 'p3', consultationDate: new Date(2026, 5, 10), patient: { dateOfBirth: new Date(1990, 0, 1), gender: 'MALE' } },
      ])
      .mockResolvedValueOnce([]);

    await useCase.execute(tenantId, month, year);

    expect(mockPrisma.consultation.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        tenantId,
        patientId: { in: ['p3'] },
        status: 'COMPLETED',
        consultationDate: { gte: new Date(2026, 0, 1), lt: new Date(2026, 5, 1) },
      },
      select: { patientId: true },
    });
  });

  it('counts a patient with Gender.OTHER in totals without attributing them to either sex column', async () => {
    mockPrisma.consultation.findMany
      .mockResolvedValueOnce([
        { patientId: 'p4', consultationDate: new Date(2026, 5, 15), patient: { dateOfBirth: new Date(1990, 0, 1), gender: 'OTHER' } },
      ])
      .mockResolvedValueOnce([]);

    const result = await useCase.execute(tenantId, month, year);

    expect(result.attendance.totalNew).toBe(1);
    expect(result.attendance.otherGenderCount).toBe(1);
    const row = result.attendance.byAgeGroupAndSex.find((r) => r.ageGroup === '20-49')!;
    expect(row.newMale).toBe(0);
    expect(row.newFemale).toBe(0);
  });

  it('tallies top conditions from ConsultationDiagnosis only, sorted descending and sliced to the limit', async () => {
    mockPrisma.consultation.findMany.mockResolvedValueOnce([]);
    mockPrisma.consultationDiagnosis.findMany.mockResolvedValue([
      { diagnosisId: 'd1', diagnosis: { code: 'A1', name: 'Malaria' } },
      { diagnosisId: 'd1', diagnosis: { code: 'A1', name: 'Malaria' } },
      { diagnosisId: 'd2', diagnosis: { code: 'B1', name: 'Typhoid' } },
    ]);

    const result = await useCase.execute(tenantId, month, year, 1);

    expect(result.topConditions).toEqual([{ diagnosisId: 'd1', code: 'A1', name: 'Malaria', count: 2 }]);
    expect(result.summary.totalDiagnosesRecorded).toBe(3);
  });

  it('queries ConsultationDiagnosis (not AdmissionDiagnosis) — OPD scope only', async () => {
    mockPrisma.consultation.findMany.mockResolvedValueOnce([]);

    await useCase.execute(tenantId, month, year);

    expect(mockPrisma.consultationDiagnosis.findMany).toHaveBeenCalledWith({
      where: { tenantId, createdAt: { gte: new Date(2026, 5, 1), lte: new Date(2026, 6, 0, 23, 59, 59, 999) } },
      select: { diagnosisId: true, diagnosis: { select: { code: true, name: true } } },
    });
    expect(mockPrisma.admissionDiagnosis).toBeUndefined();
  });
});
