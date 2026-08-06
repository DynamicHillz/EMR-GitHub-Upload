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
    // Patient-paid collections (cash/card/transfer/mobile money/manually
    // recorded insurance payments) and HMO claim settlements are two
    // separate ledgers (see generate-invoice.use-case.ts / InsuranceClaim
    // for why) — both are real revenue, so both are queried and merged
    // into the same series here rather than only counting the first.
    const [payments, paidClaims] = await Promise.all([
      this.prisma.payment.findMany({
        where: { tenantId, status: 'COMPLETED', paymentDate: { gte: filters.startDate, lte: filters.endDate } },
        select: { paymentDate: true, amount: true },
      }),
      this.prisma.insuranceClaim.findMany({
        where: { tenantId, status: 'PAID', paidAt: { gte: filters.startDate, lte: filters.endDate } },
        select: { paidAt: true, paidAmount: true },
      }),
    ]);

    const revenueByBucket = new Map<string, number>();
    const countByBucket = new Map<string, number>();
    const insuranceRevenueByBucket = new Map<string, number>();
    const claimCountByBucket = new Map<string, number>();

    for (const p of payments) {
      const key = getBucketKey(p.paymentDate, filters.period);
      revenueByBucket.set(key, (revenueByBucket.get(key) || 0) + Number(p.amount));
      countByBucket.set(key, (countByBucket.get(key) || 0) + 1);
    }

    for (const c of paidClaims) {
      const key = getBucketKey(c.paidAt!, filters.period);
      const amount = Number(c.paidAmount || 0);
      revenueByBucket.set(key, (revenueByBucket.get(key) || 0) + amount);
      insuranceRevenueByBucket.set(key, (insuranceRevenueByBucket.get(key) || 0) + amount);
      claimCountByBucket.set(key, (claimCountByBucket.get(key) || 0) + 1);
    }

    const bucketKeys = generateBucketRange(filters.startDate, filters.endDate, filters.period);
    const series = bucketKeys.map((bucket) => ({
      bucket,
      label: getBucketLabel(bucket, filters.period),
      revenue: revenueByBucket.get(bucket) || 0,
      paymentCount: countByBucket.get(bucket) || 0,
      insuranceRevenue: insuranceRevenueByBucket.get(bucket) || 0,
      claimCount: claimCountByBucket.get(bucket) || 0,
    }));

    const totalPaymentRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalInsuranceRevenue = paidClaims.reduce((sum, c) => sum + Number(c.paidAmount || 0), 0);
    const totalRevenue = totalPaymentRevenue + totalInsuranceRevenue;

    return {
      series,
      summary: {
        totalRevenue,
        totalPayments: payments.length,
        totalInsuranceRevenue,
        totalClaims: paidClaims.length,
        averagePerBucket: bucketKeys.length > 0 ? totalRevenue / bucketKeys.length : 0,
      },
    };
  }
}
