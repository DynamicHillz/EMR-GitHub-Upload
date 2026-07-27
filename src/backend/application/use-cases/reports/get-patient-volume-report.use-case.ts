/**
 * Get Patient Volume Report Use Case
 *
 * New patient registrations per bucket, plus a running total-active-patients figure.
 */

import { PrismaClient } from '@prisma/client';
import { ReportPeriod, getBucketKey, getBucketLabel, generateBucketRange } from '../../../shared/utils/report-bucketing.utils';

export interface ReportDateRangeFilters {
  startDate: Date;
  endDate: Date;
  period: ReportPeriod;
}

export class GetPatientVolumeReportUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, filters: ReportDateRangeFilters) {
    const patients = await this.prisma.patient.findMany({
      where: { tenantId, isDeleted: false, createdAt: { gte: filters.startDate, lte: filters.endDate } },
      select: { createdAt: true },
    });

    const totalActivePatients = await this.prisma.patient.count({
      where: { tenantId, isDeleted: false, createdAt: { lte: filters.endDate } },
    });

    const counts = new Map<string, number>();
    for (const p of patients) {
      const key = getBucketKey(p.createdAt, filters.period);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const bucketKeys = generateBucketRange(filters.startDate, filters.endDate, filters.period);
    const series = bucketKeys.map((bucket) => ({
      bucket,
      label: getBucketLabel(bucket, filters.period),
      newRegistrations: counts.get(bucket) || 0,
    }));

    const totalNewRegistrations = patients.length;

    return {
      series,
      summary: {
        totalNewRegistrations,
        totalActivePatients,
        averagePerBucket: bucketKeys.length > 0 ? totalNewRegistrations / bucketKeys.length : 0,
      },
    };
  }
}
