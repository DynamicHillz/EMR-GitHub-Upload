/**
 * Get Patient Balance Use Case
 *
 * REQ-BILL-4: Get total outstanding balance for a patient
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../shared/errors/AppError';

export class GetPatientBalanceUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(patientId: string, tenantId: string) {
    // Validate patient exists
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: {
        id: true,
        patientId: true,
        firstName: true,
        lastName: true,
        phone: true
      }
    });

    if (!patient) {
      throw new NotFoundError('Patient', patientId);
    }

    // Get all unpaid/partially paid invoices
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        patientId,
        paymentStatus: {
          in: ['UNPAID', 'PARTIALLY_PAID']
        },
        status: {
          not: 'CANCELLED'
        }
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        totalAmount: true,
        paidAmount: true,
        balance: true,
        dueDate: true,
        paymentStatus: true
      },
      orderBy: {
        invoiceDate: 'desc'
      }
    });

    const totalBalance = invoices.reduce((sum, inv) => sum + inv.balance, 0);
    const totalInvoices = invoices.length;

    // Calculate overdue
    const today = new Date();
    const overdueInvoices = invoices.filter(inv => {
      const dueDate = inv.dueDate || inv.invoiceDate;
      return new Date(dueDate) < today && inv.balance > 0;
    });

    const overdueBalance = overdueInvoices.reduce((sum, inv) => sum + inv.balance, 0);

    return {
      patient,
      balance: {
        total: totalBalance,
        overdue: overdueBalance,
        current: totalBalance - overdueBalance
      },
      invoices: invoices.map(inv => {
        const dueDate = inv.dueDate || inv.invoiceDate;
        const isOverdue = new Date(dueDate) < today;
        const diffTime = today.getTime() - new Date(dueDate).getTime();
        const daysOverdue = isOverdue ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;

        return {
          ...inv,
          isOverdue,
          daysOverdue
        };
      }),
      summary: {
        totalInvoices,
        paidInvoices: 0, // Could expand this
        unpaidInvoices: invoices.filter(inv => inv.paymentStatus === 'UNPAID').length,
        partiallyPaidInvoices: invoices.filter(inv => inv.paymentStatus === 'PARTIALLY_PAID').length
      }
    };
  }
}
