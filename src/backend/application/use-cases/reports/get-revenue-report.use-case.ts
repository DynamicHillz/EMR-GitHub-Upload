/**
 * Get Revenue Report Use Case
 *
 * Gross completed-payment collections per bucket. NOT netted against Refund —
 * a known first-cut limitation, not an oversight.
 */

import { PrismaClient } from '@prisma/client';
import { getBucketKey, getBucketLabel, generateBucketRange } from '../../../shared/utils/report-bucketing.utils';
import { ReportDateRangeFilters } from './get-patient-volume-report.use-case';

export class GetRevenueReportUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, filters: ReportDateRangeFilters) {
    const payments = await this.prisma.payment.findMany({
      where: { tenantId, status: 'COMPLETED', paymentDate: { gte: filters.startDate, lte: filters.endDate } },
      select: { paymentDate: true, amount: true },
    });

    const revenueByBucket = new Map<string, number>();
    const countByBucket = new Map<string, number>();
    for (const p of payments) {
      const key = getBucketKey(p.paymentDate, filters.period);
      revenueByBucket.set(key, (revenueByBucket.get(key) || 0) + Number(p.amount));
      countByBucket.set(key, (countByBucket.get(key) || 0) + 1);
    }

    const bucketKeys = generateBucketRange(filters.startDate, filters.endDate, filters.period);
    const series = bucketKeys.map((bucket) => ({
      bucket,
      label: getBucketLabel(bucket, filters.period),
      revenue: revenueByBucket.get(bucket) || 0,
      paymentCount: countByBucket.get(bucket) || 0,
    }));

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      series,
      summary: {
        totalRevenue,
        totalPayments: payments.length,
        averagePerBucket: bucketKeys.length > 0 ? totalRevenue / bucketKeys.length : 0,
      },
    };
  }
}
