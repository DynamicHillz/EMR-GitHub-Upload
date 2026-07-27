/**
 * Get Diagnosis Trends Report Use Case
 *
 * Top diagnoses by count in a date range — merges ConsultationDiagnosis
 * (outpatient) and AdmissionDiagnosis (inpatient) since inpatient diagnoses
 * are not duplicated into the consultation table.
 */

import { PrismaClient } from '@prisma/client';

export interface RankingReportFilters {
  startDate: Date;
  endDate: Date;
  limit?: number;
}

interface DiagnosisAccumulator {
  diagnosisId: string;
  code: string;
  name: string;
  count: number;
  consultationCount: number;
  admissionCount: number;
}

export class GetDiagnosisTrendsReportUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, filters: RankingReportFilters) {
    const limit = filters.limit || 10;

    const [consultationDiagnoses, admissionDiagnoses] = await Promise.all([
      this.prisma.consultationDiagnosis.findMany({
        where: { tenantId, createdAt: { gte: filters.startDate, lte: filters.endDate } },
        select: { diagnosisId: true, diagnosis: { select: { code: true, name: true } } },
      }),
      this.prisma.admissionDiagnosis.findMany({
        where: { tenantId, createdAt: { gte: filters.startDate, lte: filters.endDate } },
        select: { diagnosisId: true, diagnosis: { select: { code: true, name: true } } },
      }),
    ]);

    const map = new Map<string, DiagnosisAccumulator>();

    const upsert = (row: { diagnosisId: string; diagnosis: { code: string; name: string } }, kind: 'consultation' | 'admission') => {
      let entry = map.get(row.diagnosisId);
      if (!entry) {
        entry = {
          diagnosisId: row.diagnosisId,
          code: row.diagnosis.code,
          name: row.diagnosis.name,
          count: 0,
          consultationCount: 0,
          admissionCount: 0,
        };
        map.set(row.diagnosisId, entry);
      }
      entry.count++;
      if (kind === 'consultation') entry.consultationCount++;
      else entry.admissionCount++;
    };

    consultationDiagnoses.forEach((d) => upsert(d, 'consultation'));
    admissionDiagnoses.forEach((d) => upsert(d, 'admission'));

    const topDiagnoses = Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return {
      topDiagnoses,
      summary: {
        totalDiagnosesRecorded: consultationDiagnoses.length + admissionDiagnoses.length,
        startDate: filters.startDate.toISOString(),
        endDate: filters.endDate.toISOString(),
      },
    };
  }
}
