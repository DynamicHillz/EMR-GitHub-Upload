/**
 * Get Revenue Report Use Case Tests
 *
 * Covers the merge of two separate revenue ledgers — patient Payment rows
 * and PAID InsuranceClaim rows (HMO settlements) — into one series/summary.
 * Before this, HMO-collected money never appeared in revenue reporting at
 * all, since it was never a Payment row.
 */

import { GetRevenueReportUseCase } from './get-revenue-report.use-case';

describe('GetRevenueReportUseCase', () => {
  let useCase: GetRevenueReportUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const filters = {
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    endDate: new Date('2026-06-30T23:59:59.999Z'),
    period: 'day' as const,
  };

  beforeEach(() => {
    mockPrisma = {
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      insuranceClaim: { findMany: jest.fn().mockResolvedValue([]) },
    };
    useCase = new GetRevenueReportUseCase(mockPrisma);
  });

  it('queries completed payments and PAID insurance claims within the date range', async () => {
    await useCase.execute(tenantId, filters);

    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith({
      where: { tenantId, status: 'COMPLETED', paymentDate: { gte: filters.startDate, lte: filters.endDate } },
      select: { paymentDate: true, amount: true },
    });
    expect(mockPrisma.insuranceClaim.findMany).toHaveBeenCalledWith({
      where: { tenantId, status: 'PAID', paidAt: { gte: filters.startDate, lte: filters.endDate } },
      select: { paidAt: true, paidAmount: true },
    });
  });

  it('reports zero revenue for a period with no payments and no paid claims', async () => {
    const result = await useCase.execute(tenantId, filters);

    expect(result.summary.totalRevenue).toBe(0);
    expect(result.summary.totalInsuranceRevenue).toBe(0);
    expect(result.summary.totalClaims).toBe(0);
  });

  it('merges patient payments and HMO claim settlements into the same bucket and summary totals', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([
      { paymentDate: new Date('2026-06-10T09:00:00.000Z'), amount: 5000 },
    ]);
    mockPrisma.insuranceClaim.findMany.mockResolvedValue([
      { paidAt: new Date('2026-06-10T14:00:00.000Z'), paidAmount: 12000 },
    ]);

    const result = await useCase.execute(tenantId, filters);

    const bucket = result.series.find((s) => s.paymentCount > 0 || s.claimCount > 0);
    expect(bucket).toBeDefined();
    expect(bucket!.revenue).toBe(17000); // 5000 payment + 12000 claim, same bucket
    expect(bucket!.paymentCount).toBe(1);
    expect(bucket!.insuranceRevenue).toBe(12000);
    expect(bucket!.claimCount).toBe(1);

    expect(result.summary.totalRevenue).toBe(17000);
    expect(result.summary.totalPayments).toBe(1);
    expect(result.summary.totalInsuranceRevenue).toBe(12000);
    expect(result.summary.totalClaims).toBe(1);
  });

  it('buckets a paid claim by paidAt independently of any payment activity that day', async () => {
    mockPrisma.insuranceClaim.findMany.mockResolvedValue([
      { paidAt: new Date('2026-06-15T00:00:00.000Z'), paidAmount: 8000 },
    ]);

    const result = await useCase.execute(tenantId, filters);

    const bucket = result.series.find((s) => s.claimCount > 0);
    expect(bucket).toBeDefined();
    expect(bucket!.revenue).toBe(8000);
    expect(bucket!.paymentCount).toBe(0);
    expect(bucket!.insuranceRevenue).toBe(8000);
    expect(result.summary.totalPayments).toBe(0);
    expect(result.summary.totalInsuranceRevenue).toBe(8000);
  });

  it('treats a null paidAmount as zero rather than throwing', async () => {
    mockPrisma.insuranceClaim.findMany.mockResolvedValue([
      { paidAt: new Date('2026-06-05T00:00:00.000Z'), paidAmount: null },
    ]);

    const result = await useCase.execute(tenantId, filters);

    expect(result.summary.totalInsuranceRevenue).toBe(0);
    expect(result.summary.totalClaims).toBe(1); // still counted as a claim, just $0 contribution
  });
});
