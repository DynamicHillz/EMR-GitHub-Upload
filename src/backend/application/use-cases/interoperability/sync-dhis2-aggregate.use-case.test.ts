/**
 * Sync DHIS2 Aggregate Use Case Tests
 *
 * This use case does real date-range + age-bucketing aggregation math over
 * consultation records, so the focus here is verifying the aggregation
 * produces correct totals for a known set of mock records, not just that
 * it resolves without throwing.
 */

import { SyncDhis2AggregateUseCase } from './sync-dhis2-aggregate.use-case';

describe('SyncDhis2AggregateUseCase', () => {
  let useCase: SyncDhis2AggregateUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const month = 6;
  const year = 2026;

  // Adult: well over 5 years old at the time of consultation -> not pediatric.
  const adultConsultation = {
    consultationDate: new Date(2026, 5, 15),
    patient: { dateOfBirth: new Date(1990, 0, 1) },
  };

  // Pediatric, but not severely malnourished (muac above the 11.5cm cutoff).
  const pediatricHealthyConsultation = {
    consultationDate: new Date(2026, 5, 15),
    patient: { dateOfBirth: new Date(2023, 0, 1) },
    muac: 13,
  };

  // Pediatric AND severely malnourished (muac below the 11.5cm cutoff).
  const pediatricSevereConsultation = {
    consultationDate: new Date(2026, 5, 15),
    patient: { dateOfBirth: new Date(2024, 5, 1) },
    muac: 10,
  };

  beforeEach(() => {
    mockPrisma = {
      consultation: {
        findMany: jest.fn(),
      },
    };

    useCase = new SyncDhis2AggregateUseCase(mockPrisma);
  });

  it('should query completed consultations within the exact month date range for the tenant', async () => {
    mockPrisma.consultation.findMany.mockResolvedValue([]);

    await useCase.execute(tenantId, month, year);

    expect(mockPrisma.consultation.findMany).toHaveBeenCalledWith({
      where: {
        tenantId,
        consultationDate: {
          gte: new Date(2026, 5, 1),
          lte: new Date(2026, 6, 0, 23, 59, 59, 999),
        },
        status: 'COMPLETED',
      },
      include: { patient: true },
    });
  });

  it('should aggregate total, pediatric-under-5, and severe malnutrition counts correctly', async () => {
    mockPrisma.consultation.findMany.mockResolvedValue([
      adultConsultation,
      pediatricHealthyConsultation,
      pediatricSevereConsultation,
    ]);

    const result = await useCase.execute(tenantId, month, year);

    expect(result.success).toBe(true);
    expect(result.period).toBe('2026-06');
    expect(result.payload).toEqual(
      expect.objectContaining({
        dataSet: 'DHIS2_CLINIC_SUMMARY',
        period: '202606',
        orgUnit: tenantId,
        completeDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        dataValues: [
          { dataElement: 'TOTAL_OUTPATIENT_VISITS', value: 3 },
          { dataElement: 'PEDIATRIC_UNDER_5_VISITS', value: 2 },
          { dataElement: 'SEVERE_ACUTE_MALNUTRITION_CASES', value: 1 },
        ],
      })
    );
  });

  it('should report all-zero aggregates when there are no matching consultations', async () => {
    mockPrisma.consultation.findMany.mockResolvedValue([]);

    const result = await useCase.execute(tenantId, month, year);

    expect(result.payload.dataValues).toEqual([
      { dataElement: 'TOTAL_OUTPATIENT_VISITS', value: 0 },
      { dataElement: 'PEDIATRIC_UNDER_5_VISITS', value: 0 },
      { dataElement: 'SEVERE_ACUTE_MALNUTRITION_CASES', value: 0 },
    ]);
  });

  it('should not count a pediatric consultation as severe malnutrition when muac is missing', async () => {
    const pediatricNoMuac = {
      consultationDate: new Date(2026, 5, 15),
      patient: { dateOfBirth: new Date(2023, 0, 1) },
    };
    mockPrisma.consultation.findMany.mockResolvedValue([pediatricNoMuac]);

    const result = await useCase.execute(tenantId, month, year);

    expect(result.payload.dataValues).toEqual([
      { dataElement: 'TOTAL_OUTPATIENT_VISITS', value: 1 },
      { dataElement: 'PEDIATRIC_UNDER_5_VISITS', value: 1 },
      { dataElement: 'SEVERE_ACUTE_MALNUTRITION_CASES', value: 0 },
    ]);
  });

  it('should include a success message about the pushed DHIS2 report', async () => {
    mockPrisma.consultation.findMany.mockResolvedValue([]);

    const result = await useCase.execute(tenantId, month, year);

    expect(result.message).toBe('Successfully generated and pushed DHIS2 aggregate report');
  });
});
