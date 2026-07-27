/**
 * Get Appointment No-Show Report Use Case
 *
 * No-show rate per bucket. Denominator is appointments that were actually
 * resolved (COMPLETED or NO_SHOW) — excludes CANCELLED (not a no-show) and
 * still-pending SCHEDULED appointments (not yet resolved).
 */

import { PrismaClient } from '@prisma/client';
import { getBucketKey, getBucketLabel, generateBucketRange } from '../../../shared/utils/report-bucketing.utils';
import { ReportDateRangeFilters } from './get-patient-volume-report.use-case';

export class GetAppointmentNoShowReportUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, filters: ReportDateRangeFilters) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        isDeleted: false,
        appointmentDate: { gte: filters.startDate, lte: filters.endDate },
        status: { in: ['COMPLETED', 'NO_SHOW'] },
      },
      select: { appointmentDate: true, status: true },
    });

    const noShowByBucket = new Map<string, number>();
    const completedByBucket = new Map<string, number>();
    for (const a of appointments) {
      const key = getBucketKey(a.appointmentDate, filters.period);
      if (a.status === 'NO_SHOW') {
        noShowByBucket.set(key, (noShowByBucket.get(key) || 0) + 1);
      } else {
        completedByBucket.set(key, (completedByBucket.get(key) || 0) + 1);
      }
    }

    const bucketKeys = generateBucketRange(filters.startDate, filters.endDate, filters.period);
    const series = bucketKeys.map((bucket) => {
      const noShowCount = noShowByBucket.get(bucket) || 0;
      const completedCount = completedByBucket.get(bucket) || 0;
      const resolvedCount = noShowCount + completedCount;
      return {
        bucket,
        label: getBucketLabel(bucket, filters.period),
        noShowCount,
        completedCount,
        resolvedCount,
        noShowRate: resolvedCount > 0 ? noShowCount / resolvedCount : 0,
      };
    });

    const totalNoShows = appointments.filter((a) => a.status === 'NO_SHOW').length;
    const totalResolved = appointments.length;

    return {
      series,
      summary: {
        totalNoShows,
        totalResolved,
        overallNoShowRate: totalResolved > 0 ? totalNoShows / totalResolved : 0,
      },
    };
  }
}
