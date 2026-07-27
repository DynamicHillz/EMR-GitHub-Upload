/**
 * Get Outstanding Invoices Use Case
 *
 * REQ-BILL-4: Track outstanding balances
 */

import { PrismaClient } from '@prisma/client';

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

export class GetOutstandingInvoicesUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        isDeleted: false,
        paymentStatus: {
          in: ['UNPAID', 'PARTIALLY_PAID']
        },
        status: {
          not: 'CANCELLED'
        }
      },
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
      }
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

    // Calculate totals
    const totalOutstanding = outstanding.reduce((sum, inv) => sum + inv.balance, 0);
    const totalInvoices = outstanding.length;

    // Age analysis
    const aging = {
      current: outstanding.filter(inv => inv.daysOverdue === 0).reduce((sum, inv) => sum + inv.balance, 0),
      days1_30: outstanding.filter(inv => inv.daysOverdue >= 1 && inv.daysOverdue <= 30).reduce((sum, inv) => sum + inv.balance, 0),
      days31_60: outstanding.filter(inv => inv.daysOverdue >= 31 && inv.daysOverdue <= 60).reduce((sum, inv) => sum + inv.balance, 0),
      days61_90: outstanding.filter(inv => inv.daysOverdue >= 61 && inv.daysOverdue <= 90).reduce((sum, inv) => sum + inv.balance, 0),
      days90Plus: outstanding.filter(inv => inv.daysOverdue > 90).reduce((sum, inv) => sum + inv.balance, 0)
    };

    return {
      invoices: outstanding,
      summary: {
        totalOutstanding,
        totalInvoices,
        aging
      }
    };
  }
}
