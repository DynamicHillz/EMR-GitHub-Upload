/**
 * Get Outstanding Invoices Use Case
 *
 * REQ-BILL-4: Track outstanding balances
 */

import { PrismaClient, Prisma } from '@prisma/client';

export interface OutstandingInvoice {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  patientId: string;
  patientName: string;
  patientPhone: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  daysOverdue: number;
  status: string;
}

interface AgingBucketRow {
  bucket: 'current' | 'days1_30' | 'days31_60' | 'days61_90' | 'days90Plus';
  totalAmount: unknown; // NUMERIC from Postgres — string or Decimal depending on driver, always Number()-safe
  invoiceCount: bigint | number;
}

interface AgingBucketSummary {
  totalAmount: number;
  invoiceCount: number;
}

const emptyAging = (): Record<AgingBucketRow['bucket'], AgingBucketSummary> => ({
  current: { totalAmount: 0, invoiceCount: 0 },
  days1_30: { totalAmount: 0, invoiceCount: 0 },
  days31_60: { totalAmount: 0, invoiceCount: 0 },
  days61_90: { totalAmount: 0, invoiceCount: 0 },
  days90Plus: { totalAmount: 0, invoiceCount: 0 },
});

export class GetOutstandingInvoicesUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, page: number = 1, limit: number = 100) {
    const skip = (page - 1) * limit;
    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      isDeleted: false,
      paymentStatus: {
        in: ['UNPAID', 'PARTIALLY_PAID']
      },
      status: {
        not: 'CANCELLED'
      }
    };

    // The aging buckets (and the totals derived from them below) are
    // computed in SQL over the FULL matching set, not just this page — a
    // GROUP BY aggregate the Prisma query builder can't express directly
    // (bucketing by a computed day-difference), same $queryRaw justification
    // as generate-stock-alerts.use-case.ts. Previously this was a JS
    // .filter()+.reduce() pass over every unpaid/partial invoice the tenant
    // has ever had, unbounded, on every dashboard load.
    const bucketRows = await this.prisma.$queryRaw<AgingBucketRow[]>`
      SELECT
        CASE
          WHEN days_overdue <= 0 THEN 'current'
          WHEN days_overdue BETWEEN 1 AND 30 THEN 'days1_30'
          WHEN days_overdue BETWEEN 31 AND 60 THEN 'days31_60'
          WHEN days_overdue BETWEEN 61 AND 90 THEN 'days61_90'
          ELSE 'days90Plus'
        END AS bucket,
        SUM(balance) AS "totalAmount",
        COUNT(*) AS "invoiceCount"
      FROM (
        SELECT
          balance,
          FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE("dueDate", "invoiceDate"))) / 86400) AS days_overdue
        FROM invoices
        WHERE "tenantId" = ${tenantId}
          AND "isDeleted" = false
          AND "paymentStatus" IN ('UNPAID', 'PARTIALLY_PAID')
          AND status != 'CANCELLED'
      ) sub
      GROUP BY bucket
    `;

    const aging = emptyAging();
    let totalOutstanding = 0;
    let totalInvoices = 0;
    for (const row of bucketRows) {
      const amount = Number(row.totalAmount);
      const count = Number(row.invoiceCount);
      aging[row.bucket] = { totalAmount: amount, invoiceCount: count };
      totalOutstanding += amount;
      totalInvoices += count;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      },
      orderBy: {
        invoiceDate: 'asc'
      },
      skip,
      take: limit,
    });

    const today = new Date();
    const outstanding: OutstandingInvoice[] = invoices.map(inv => {
      const dueDate = inv.dueDate || inv.invoiceDate;
      const diffTime = today.getTime() - new Date(dueDate).getTime();
      const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        patientId: inv.patient.patientId,
        patientName: `${inv.patient.firstName} ${inv.patient.lastName}`,
        patientPhone: inv.patient.phone,
        totalAmount: Number(inv.totalAmount),
        paidAmount: Number(inv.paidAmount),
        balance: Number(inv.balance),
        daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
        status: inv.paymentStatus
      };
    });

    return {
      invoices: outstanding,
      page,
      limit,
      totalPages: Math.ceil(totalInvoices / limit) || 1,
      summary: {
        totalOutstanding,
        totalInvoices,
        aging
      }
    };
  }
}
