/**
 * Get Payment History Use Case
 *
 * REQ-BILL-3: Get payment history for invoice or patient
 */

import { PrismaClient } from '@prisma/client';
import type { PaymentMethod } from '../../../shared/types/prisma-enums.ts';;

export interface GetPaymentHistoryFilters {
  invoiceId?: string;
  patientId?: string;
  paymentMethod?: PaymentMethod;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class GetPaymentHistoryUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, filters: GetPaymentHistoryFilters = {}) {
    const where: any = { tenantId };

    if (filters.invoiceId) {
      where.invoiceId = filters.invoiceId;
    }

    if (filters.patientId) {
      where.patientId = filters.patientId;
    }

    if (filters.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters.startDate || filters.endDate) {
      where.paymentDate = {};
      if (filters.startDate) {
        where.paymentDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.paymentDate.lte = filters.endDate;
      }
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              totalAmount: true,
              balance: true
            }
          },
          patient: {
            select: {
              patientId: true,
              firstName: true,
              lastName: true
            }
          },
          processedBy: {
            select: {
              firstName: true,
              lastName: true,
              role: true
            }
          }
        },
        orderBy: { paymentDate: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0
      }),
      this.prisma.payment.count({ where })
    ]);

    return {
      payments,
      total,
      limit: filters.limit || 50,
      offset: filters.offset || 0
    };
  }
}
