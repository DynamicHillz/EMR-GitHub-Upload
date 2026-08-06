/**
 * Sync DHIS2 Aggregate Use Case
 *
 * Computes a month's aggregate indicators from real clinical data and
 * pushes them to the tenant's configured DHIS2 instance via dataValueSets.
 * Every attempt (including ones that never reach DHIS2) is persisted as a
 * Dhis2SyncLog row, so "did we already submit this period" is always
 * answerable from history rather than memory.
 */

import { PrismaClient } from '@prisma/client';
import { Dhis2Client } from '../../../infrastructure/external/dhis2.client';
import { decrypt } from '../../../infrastructure/security/encryption.util';
import { ageInYears } from '../../../shared/utils/age.utils';

// WHO/UNICEF cutoff for Severe Acute Malnutrition by MUAC in children under 5.
const SEVERE_ACUTE_MALNUTRITION_MUAC_CM = 11.5;

export interface SyncDhis2Result {
  status: 'NOT_CONFIGURED' | 'SUCCESS' | 'WARNING' | 'REJECTED' | 'AUTH_ERROR' | 'NETWORK_ERROR';
  message: string;
  period: string;
  payload?: object;
  importCount?: { imported: number; updated: number; ignored: number; deleted: number };
  logId?: string;
}

export class SyncDhis2AggregateUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, month: number, year: number, triggeredById: string): Promise<SyncDhis2Result> {
    const period = `${year}${month.toString().padStart(2, '0')}`;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const missingConfig = !tenant.dhis2Enabled
      || !tenant.dhis2BaseUrl
      || !tenant.dhis2Username
      || !tenant.dhis2Password
      || !tenant.dhis2OrgUnitId
      || !tenant.dhis2DataElementTotalVisits
      || !tenant.dhis2DataElementPediatricUnder5
      || !tenant.dhis2DataElementSevereMalnutrition
      || !tenant.dhis2CategoryOptionCombo;

    if (missingConfig) {
      // Nothing was attempted — no Dhis2SyncLog row, there's nothing to log.
      return {
        status: 'NOT_CONFIGURED',
        message: 'DHIS2 is not fully configured for this clinic yet — set it up under Settings first.',
        period,
      };
    }

    // Outpatient visit counts — genuinely correct against Consultation today.
    const consultations = await this.prisma.consultation.findMany({
      where: {
        tenantId,
        consultationDate: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
      },
      include: { patient: true },
    });

    const totalConsultations = consultations.length;
    const pediatricUnder5 = consultations.filter((c) => ageInYears(c.patient.dateOfBirth, c.consultationDate) < 5).length;

    // Severe malnutrition — Consultation has no `muac` column at all; the
    // real field lives on Triage (patient-level pediatric screening), not
    // on Consultation. Previously this always silently computed to 0.
    const triageAssessments = await this.prisma.triage.findMany({
      where: {
        tenantId,
        triageTime: { gte: startDate, lte: endDate },
      },
      include: { patient: true },
    });

    const severeMalnutrition = triageAssessments.filter(
      (t) =>
        t.muac != null &&
        t.muac < SEVERE_ACUTE_MALNUTRITION_MUAC_CM &&
        ageInYears(t.patient.dateOfBirth, t.triageTime) < 5
    ).length;

    // Live births + PPH incidents — added after tenants may already have
    // DHIS2 fully configured, so these two data-element UIDs are treated as
    // optional/additive rather than added to missingConfig above: an
    // already-configured tenant that hasn't set them yet keeps getting the
    // original 3 metrics pushed exactly as before, rather than silently
    // losing DHIS2 sync entirely because of an unrelated new field.
    const deliveredLabors = await this.prisma.laborRecord.findMany({
      where: { tenantId, status: 'DELIVERED', deliveredAt: { gte: startDate, lte: endDate }, isDeleted: false },
      select: { babyOutcome: true, modeOfDelivery: true, estimatedBloodLossMl: true },
    });
    const liveBirths = deliveredLabors.filter((l) => l.babyOutcome === 'LIVE_BIRTH').length;
    const severePostpartumHemorrhage = deliveredLabors.filter((l) => {
      if (l.estimatedBloodLossMl == null) return false;
      const threshold = l.modeOfDelivery === 'CESAREAN_SECTION' ? 1000 : 500;
      return l.estimatedBloodLossMl >= threshold;
    }).length;

    const dataValues: Array<{ dataElement: string; categoryOptionCombo: string; value: number }> = [
      {
        dataElement: tenant.dhis2DataElementTotalVisits!,
        categoryOptionCombo: tenant.dhis2CategoryOptionCombo!,
        value: totalConsultations,
      },
      {
        dataElement: tenant.dhis2DataElementPediatricUnder5!,
        categoryOptionCombo: tenant.dhis2CategoryOptionCombo!,
        value: pediatricUnder5,
      },
      {
        dataElement: tenant.dhis2DataElementSevereMalnutrition!,
        categoryOptionCombo: tenant.dhis2CategoryOptionCombo!,
        value: severeMalnutrition,
      },
    ];
    if (tenant.dhis2DataElementLiveBirths) {
      dataValues.push({ dataElement: tenant.dhis2DataElementLiveBirths, categoryOptionCombo: tenant.dhis2CategoryOptionCombo!, value: liveBirths });
    }
    if (tenant.dhis2DataElementSeverePostpartumHemorrhage) {
      dataValues.push({
        dataElement: tenant.dhis2DataElementSeverePostpartumHemorrhage,
        categoryOptionCombo: tenant.dhis2CategoryOptionCombo!,
        value: severePostpartumHemorrhage,
      });
    }

    const dhis2Payload = {
      dataSet: 'DHIS2_CLINIC_SUMMARY',
      completeDate: new Date().toISOString().split('T')[0],
      period,
      orgUnit: tenant.dhis2OrgUnitId,
      dataValues,
    };

    const client = new Dhis2Client({
      baseUrl: tenant.dhis2BaseUrl!,
      username: tenant.dhis2Username!,
      password: decrypt(tenant.dhis2Password!),
    });

    const result = await client.pushDataValueSet(dhis2Payload);

    const status = result.ok ? result.status : result.reason;
    const log = await this.prisma.dhis2SyncLog.create({
      data: {
        tenantId,
        period,
        payload: dhis2Payload as any,
        status,
        responseSummary: (result.ok
          ? { importCount: result.importCount, conflicts: result.conflicts }
          : { message: result.message }) as any,
        triggeredById,
      },
    });

    if (result.ok) {
      return {
        status: result.status,
        message: result.status === 'SUCCESS'
          ? 'Successfully pushed to DHIS2.'
          : 'Pushed to DHIS2 with warnings — check the import counts.',
        period,
        payload: dhis2Payload,
        importCount: result.importCount,
        logId: log.id,
      };
    }

    return {
      status: result.reason,
      message: result.message,
      period,
      payload: dhis2Payload,
      logId: log.id,
    };
  }
}
