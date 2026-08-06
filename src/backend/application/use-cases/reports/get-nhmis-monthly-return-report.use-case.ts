/**
 * Get NHMIS Monthly Return Report Use Case
 *
 * Computes Nigeria's NHMIS Facility Monthly Summary Form (General OPD
 * scope) from live data: attendance by age group x sex x new/repeat, and
 * top conditions seen. Built against the standard/commonly-known NHMIS
 * structure (no real copy of a specific facility's form was available) —
 * expect the age-group bands and section layout to need adjusting once
 * compared against the real paper form.
 *
 * "New" vs "repeat" follows NHMIS's own convention: a patient is "new" if
 * this is their first completed consultation in the current calendar year,
 * "repeat" otherwise — no schema change needed, this is fully derivable
 * from existing Consultation history.
 *
 * Referrals in/out are NOT computed here — there is no referral field or
 * model anywhere in this EMR yet. That section is rendered as blank,
 * manually-fillable cells on the print page, not from this payload.
 */

import { PrismaClient } from '@prisma/client';
import { ageInYears, ageGroup, NHMIS_AGE_GROUPS, NhmisAgeGroup } from '../../../shared/utils/age.utils';

export interface NhmisAttendanceCell {
  ageGroup: NhmisAgeGroup;
  newMale: number;
  newFemale: number;
  repeatMale: number;
  repeatFemale: number;
}

export interface NhmisTopCondition {
  diagnosisId: string;
  code: string;
  name: string;
  count: number;
}

export class GetNhmisMonthlyReturnReportUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, month: number, year: number, limit = 10) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    const startOfYear = new Date(year, 0, 1);

    const consultations = await this.prisma.consultation.findMany({
      where: {
        tenantId,
        consultationDate: { gte: startOfMonth, lte: endOfMonth },
        status: 'COMPLETED',
      },
      select: {
        patientId: true,
        consultationDate: true,
        patient: { select: { dateOfBirth: true, gender: true } },
      },
    });

    const patientIds = [...new Set(consultations.map((c) => c.patientId))];

    // A patient counts as "repeat" this month if they had any earlier
    // completed consultation this same calendar year.
    const priorConsultations = patientIds.length > 0
      ? await this.prisma.consultation.findMany({
          where: {
            tenantId,
            patientId: { in: patientIds },
            status: 'COMPLETED',
            consultationDate: { gte: startOfYear, lt: startOfMonth },
          },
          select: { patientId: true },
        })
      : [];

    const repeatPatientIds = new Set(priorConsultations.map((c) => c.patientId));

    // Every age-group row is present at zero by default, so the printed
    // form always shows the full grid even for a quiet month.
    const matrix = new Map<NhmisAgeGroup, NhmisAttendanceCell>();
    for (const group of NHMIS_AGE_GROUPS) {
      matrix.set(group, { ageGroup: group, newMale: 0, newFemale: 0, repeatMale: 0, repeatFemale: 0 });
    }

    let totalNew = 0;
    let totalRepeat = 0;
    // Patients recorded as Gender.OTHER don't fit the NHMIS form's binary
    // male/female columns — counted in the totals, called out separately
    // rather than silently folded into either column.
    let otherGenderCount = 0;

    for (const c of consultations) {
      const cell = matrix.get(ageGroup(ageInYears(c.patient.dateOfBirth, c.consultationDate)))!;
      const isRepeat = repeatPatientIds.has(c.patientId);

      if (isRepeat) totalRepeat++;
      else totalNew++;

      if (c.patient.gender === 'MALE') {
        if (isRepeat) cell.repeatMale++;
        else cell.newMale++;
      } else if (c.patient.gender === 'FEMALE') {
        if (isRepeat) cell.repeatFemale++;
        else cell.newFemale++;
      } else {
        otherGenderCount++;
      }
    }

    // Top conditions — ConsultationDiagnosis only (OPD scope). Unlike
    // get-diagnosis-trends-report.use-case.ts, this deliberately does not
    // merge in AdmissionDiagnosis (inpatient), since this form is OPD-only.
    const diagnoses = await this.prisma.consultationDiagnosis.findMany({
      where: { tenantId, createdAt: { gte: startOfMonth, lte: endOfMonth } },
      select: { diagnosisId: true, diagnosis: { select: { code: true, name: true } } },
    });

    const diagnosisMap = new Map<string, NhmisTopCondition>();
    for (const d of diagnoses) {
      const entry = diagnosisMap.get(d.diagnosisId);
      if (entry) {
        entry.count++;
      } else {
        diagnosisMap.set(d.diagnosisId, {
          diagnosisId: d.diagnosisId,
          code: d.diagnosis.code,
          name: d.diagnosis.name,
          count: 1,
        });
      }
    }

    const topConditions = Array.from(diagnosisMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return {
      period: { month, year },
      attendance: {
        byAgeGroupAndSex: Array.from(matrix.values()),
        totalNew,
        totalRepeat,
        otherGenderCount,
        grandTotal: totalNew + totalRepeat,
      },
      topConditions,
      summary: {
        totalConsultations: consultations.length,
        totalDiagnosesRecorded: diagnoses.length,
      },
    };
  }
}
