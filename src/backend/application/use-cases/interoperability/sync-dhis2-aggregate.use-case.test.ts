/**
 * Sync DHIS2 Aggregate Use Case Tests
 *
 * Covers: the NOT_CONFIGURED short-circuit, real aggregation math (visits +
 * pediatric-under-5 from Consultation, severe malnutrition from Triage —
 * not the nonexistent Consultation.muac the old mock read), and every
 * Dhis2Client outcome (SUCCESS/WARNING/REJECTED/AUTH_ERROR/NETWORK_ERROR),
 * each of which must persist a Dhis2SyncLog row.
 */

import { SyncDhis2AggregateUseCase } from './sync-dhis2-aggregate.use-case';
import { Dhis2Client } from '../../../infrastructure/external/dhis2.client';

jest.mock('../../../infrastructure/external/dhis2.client');
jest.mock('../../../infrastructure/security/encryption.util', () => ({
  decrypt: jest.fn((value: string) => `decrypted:${value}`),
  encrypt: jest.fn((value: string) => `encrypted:${value}`),
}));

describe('SyncDhis2AggregateUseCase', () => {
  let useCase: SyncDhis2AggregateUseCase;
  let mockPrisma: any;
  let mockPushDataValueSet: jest.Mock;

  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const month = 6;
  const year = 2026;

  const configuredTenant = {
    id: tenantId,
    dhis2Enabled: true,
    dhis2BaseUrl: 'https://play.dhis2.org/dev',
    dhis2Username: 'admin',
    dhis2Password: 'encrypted:secret',
    dhis2OrgUnitId: 'ORG-UNIT-UID',
    dhis2DataElementTotalVisits: 'DE-TOTAL',
    dhis2DataElementPediatricUnder5: 'DE-PED',
    dhis2DataElementSevereMalnutrition: 'DE-SAM',
    dhis2CategoryOptionCombo: 'COC-DEFAULT',
  };

  // Adult: well over 5 years old at the time of consultation -> not pediatric.
  const adultConsultation = {
    consultationDate: new Date(2026, 5, 15),
    patient: { dateOfBirth: new Date(1990, 0, 1) },
  };

  // Pediatric consultation (age-bucketing still comes from Consultation).
  const pediatricConsultation = {
    consultationDate: new Date(2026, 5, 15),
    patient: { dateOfBirth: new Date(2023, 0, 1) },
  };

  // Pediatric triage, healthy MUAC (above the 11.5cm cutoff).
  const pediatricHealthyTriage = {
    triageTime: new Date(2026, 5, 10),
    patient: { dateOfBirth: new Date(2023, 0, 1) },
    muac: 13,
  };

  // Pediatric triage, severely malnourished (below the 11.5cm cutoff).
  const pediatricSevereTriage = {
    triageTime: new Date(2026, 5, 12),
    patient: { dateOfBirth: new Date(2024, 5, 1) },
    muac: 10,
  };

  beforeEach(() => {
    mockPrisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue(configuredTenant) },
      consultation: { findMany: jest.fn().mockResolvedValue([]) },
      triage: { findMany: jest.fn().mockResolvedValue([]) },
      laborRecord: { findMany: jest.fn().mockResolvedValue([]) },
      dhis2SyncLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
    };

    mockPushDataValueSet = jest.fn();
    (Dhis2Client as unknown as jest.Mock).mockImplementation(() => ({
      pushDataValueSet: mockPushDataValueSet,
    }));

    useCase = new SyncDhis2AggregateUseCase(mockPrisma);
  });

  it('returns NOT_CONFIGURED and logs nothing when DHIS2 is disabled for the tenant', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ ...configuredTenant, dhis2Enabled: false });

    const result = await useCase.execute(tenantId, month, year, userId);

    expect(result.status).toBe('NOT_CONFIGURED');
    expect(mockPushDataValueSet).not.toHaveBeenCalled();
    expect(mockPrisma.dhis2SyncLog.create).not.toHaveBeenCalled();
  });

  it('returns NOT_CONFIGURED when enabled but missing a required field (e.g. org unit)', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ ...configuredTenant, dhis2OrgUnitId: null });

    const result = await useCase.execute(tenantId, month, year, userId);

    expect(result.status).toBe('NOT_CONFIGURED');
    expect(mockPushDataValueSet).not.toHaveBeenCalled();
  });

  it('queries completed consultations within the exact month range for visit counts', async () => {
    mockPushDataValueSet.mockResolvedValue({ ok: true, status: 'SUCCESS', importCount: { imported: 3, updated: 0, ignored: 0, deleted: 0 } });

    await useCase.execute(tenantId, month, year, userId);

    expect(mockPrisma.consultation.findMany).toHaveBeenCalledWith({
      where: {
        tenantId,
        consultationDate: { gte: new Date(2026, 5, 1), lte: new Date(2026, 6, 0, 23, 59, 59, 999) },
        status: 'COMPLETED',
      },
      include: { patient: true },
    });
  });

  it('queries Triage (not Consultation) for severe malnutrition, within the same month range', async () => {
    mockPushDataValueSet.mockResolvedValue({ ok: true, status: 'SUCCESS', importCount: { imported: 3, updated: 0, ignored: 0, deleted: 0 } });

    await useCase.execute(tenantId, month, year, userId);

    expect(mockPrisma.triage.findMany).toHaveBeenCalledWith({
      where: {
        tenantId,
        triageTime: { gte: new Date(2026, 5, 1), lte: new Date(2026, 6, 0, 23, 59, 59, 999) },
      },
      include: { patient: true },
    });
  });

  it('aggregates total visits and pediatric-under-5 from Consultation, and severe malnutrition from Triage', async () => {
    mockPrisma.consultation.findMany.mockResolvedValue([adultConsultation, pediatricConsultation]);
    mockPrisma.triage.findMany.mockResolvedValue([pediatricHealthyTriage, pediatricSevereTriage]);
    mockPushDataValueSet.mockResolvedValue({ ok: true, status: 'SUCCESS', importCount: { imported: 3, updated: 0, ignored: 0, deleted: 0 } });

    const result = await useCase.execute(tenantId, month, year, userId);

    expect(mockPushDataValueSet).toHaveBeenCalledWith(
      expect.objectContaining({
        dataSet: 'DHIS2_CLINIC_SUMMARY',
        period: '202606',
        orgUnit: 'ORG-UNIT-UID',
        dataValues: [
          { dataElement: 'DE-TOTAL', categoryOptionCombo: 'COC-DEFAULT', value: 2 },
          { dataElement: 'DE-PED', categoryOptionCombo: 'COC-DEFAULT', value: 1 },
          { dataElement: 'DE-SAM', categoryOptionCombo: 'COC-DEFAULT', value: 1 },
        ],
      })
    );
    expect(result.status).toBe('SUCCESS');
  });

  it('does not count a pediatric triage as severe malnutrition when muac is missing', async () => {
    mockPrisma.triage.findMany.mockResolvedValue([{ triageTime: new Date(2026, 5, 15), patient: { dateOfBirth: new Date(2023, 0, 1) } }]);
    mockPushDataValueSet.mockResolvedValue({ ok: true, status: 'SUCCESS', importCount: { imported: 1, updated: 0, ignored: 0, deleted: 0 } });

    await useCase.execute(tenantId, month, year, userId);

    expect(mockPushDataValueSet).toHaveBeenCalledWith(
      expect.objectContaining({ dataValues: expect.arrayContaining([{ dataElement: 'DE-SAM', categoryOptionCombo: 'COC-DEFAULT', value: 0 }]) })
    );
  });

  it('omits live births / PPH from the payload when their data-element UIDs are not configured, without affecting the existing 3 metrics', async () => {
    mockPushDataValueSet.mockResolvedValue({ ok: true, status: 'SUCCESS', importCount: { imported: 0, updated: 0, ignored: 0, deleted: 0 } });

    await useCase.execute(tenantId, month, year, userId);

    const payload = mockPushDataValueSet.mock.calls[0][0];
    expect(payload.dataValues).toHaveLength(3);
    expect(payload.dataValues.map((d: any) => d.dataElement)).toEqual(['DE-TOTAL', 'DE-PED', 'DE-SAM']);
  });

  it('includes live births and mode-aware PPH incident counts once their data-element UIDs are configured', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      ...configuredTenant,
      dhis2DataElementLiveBirths: 'DE-LIVEBIRTHS',
      dhis2DataElementSeverePostpartumHemorrhage: 'DE-PPH',
    });
    mockPrisma.laborRecord.findMany.mockResolvedValue([
      { babyOutcome: 'LIVE_BIRTH', modeOfDelivery: 'SVD', estimatedBloodLossMl: 200 },
      { babyOutcome: 'LIVE_BIRTH', modeOfDelivery: 'SVD', estimatedBloodLossMl: 600 }, // vaginal PPH (>=500)
      { babyOutcome: 'LIVE_BIRTH', modeOfDelivery: 'CESAREAN_SECTION', estimatedBloodLossMl: 700 }, // NOT cesarean PPH (<1000)
      { babyOutcome: 'STILLBIRTH_FRESH', modeOfDelivery: 'SVD', estimatedBloodLossMl: 1500 }, // PPH but not a live birth
    ]);
    mockPushDataValueSet.mockResolvedValue({ ok: true, status: 'SUCCESS', importCount: { imported: 0, updated: 0, ignored: 0, deleted: 0 } });

    await useCase.execute(tenantId, month, year, userId);

    expect(mockPushDataValueSet).toHaveBeenCalledWith(
      expect.objectContaining({
        dataValues: expect.arrayContaining([
          { dataElement: 'DE-LIVEBIRTHS', categoryOptionCombo: 'COC-DEFAULT', value: 3 },
          { dataElement: 'DE-PPH', categoryOptionCombo: 'COC-DEFAULT', value: 2 },
        ]),
      })
    );
  });

  it('decrypts the stored password before constructing the DHIS2 client', async () => {
    mockPushDataValueSet.mockResolvedValue({ ok: true, status: 'SUCCESS', importCount: { imported: 0, updated: 0, ignored: 0, deleted: 0 } });

    await useCase.execute(tenantId, month, year, userId);

    expect(Dhis2Client).toHaveBeenCalledWith({
      baseUrl: 'https://play.dhis2.org/dev',
      username: 'admin',
      password: 'decrypted:encrypted:secret',
    });
  });

  it('persists a Dhis2SyncLog row on SUCCESS with the import count', async () => {
    mockPushDataValueSet.mockResolvedValue({ ok: true, status: 'SUCCESS', importCount: { imported: 5, updated: 1, ignored: 0, deleted: 0 } });

    const result = await useCase.execute(tenantId, month, year, userId);

    expect(mockPrisma.dhis2SyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId,
          period: '202606',
          status: 'SUCCESS',
          triggeredById: userId,
        }),
      })
    );
    expect(result.status).toBe('SUCCESS');
    expect(result.logId).toBe('log-1');
  });

  it('persists a Dhis2SyncLog row on WARNING and surfaces the warning message', async () => {
    mockPushDataValueSet.mockResolvedValue({ ok: true, status: 'WARNING', importCount: { imported: 2, updated: 0, ignored: 1, deleted: 0 }, conflicts: [{ object: 'x', value: 'bad' }] });

    const result = await useCase.execute(tenantId, month, year, userId);

    expect(result.status).toBe('WARNING');
    expect(mockPrisma.dhis2SyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'WARNING' }) })
    );
  });

  it('persists a FAILED-style log row and returns REJECTED when DHIS2 rejects the submission', async () => {
    mockPushDataValueSet.mockResolvedValue({ ok: false, reason: 'REJECTED', message: 'Data element does not exist' });

    const result = await useCase.execute(tenantId, month, year, userId);

    expect(result.status).toBe('REJECTED');
    expect(result.message).toBe('Data element does not exist');
    expect(mockPrisma.dhis2SyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) })
    );
  });

  it('returns AUTH_ERROR when DHIS2 rejects the credentials', async () => {
    mockPushDataValueSet.mockResolvedValue({ ok: false, reason: 'AUTH_ERROR', message: 'DHIS2 rejected the credentials' });

    const result = await useCase.execute(tenantId, month, year, userId);

    expect(result.status).toBe('AUTH_ERROR');
  });

  it('returns NETWORK_ERROR when DHIS2 cannot be reached', async () => {
    mockPushDataValueSet.mockResolvedValue({ ok: false, reason: 'NETWORK_ERROR', message: 'Could not reach the DHIS2 server' });

    const result = await useCase.execute(tenantId, month, year, userId);

    expect(result.status).toBe('NETWORK_ERROR');
  });

  it('throws when the tenant does not exist', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(tenantId, month, year, userId)).rejects.toThrow('Tenant not found');
  });
});
