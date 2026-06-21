/**
 * Get Invoices Use Case
 *
 * REQ-BILL-1: List invoices with filtering
 */

import { PrismaClient } from '@prisma/client';
import type { InvoiceStatus, PaymentStatus } from '../../../shared/types/prisma-enums.ts';;

export interface GetInvoicesFilters {
  patientId?: string;
  status?: InvoiceStatus;
  paymentStatus?: PaymentStatus;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export class GetInvoicesUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, filters: GetInvoicesFilters = {}) {
    const where: any = { tenantId };

    if (filters.patientId) {
      where.patientId = filters.patientId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }

    if (filters.startDate || filters.endDate) {
      where.invoiceDate = {};
      if (filters.startDate) {
        where.invoiceDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.invoiceDate.lte = filters.endDate;
      }
    }

    if (filters.search) {
      where.OR = [
        { invoiceNumber: { contains: filters.search, } },
        { patient: { firstName: { contains: filters.search, } } },
        { patient: { lastName: { contains: filters.search, } } }
      ];
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
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
          },
          issuedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true
            }
          },
          payments: {
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              paymentMethod: true
            }
          }
        },
        orderBy: { invoiceDate: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0
      }),
      this.prisma.invoice.count({ where })
    ]);

    return {
      invoices: invoices.map(inv => ({
        ...inv,
        lineItems: JSON.parse(inv.lineItems)
      })),
      total,
      limit: filters.limit || 50,
      offset: filters.offset || 0
    };
  }
}
