/**
 * Get Refund Requests Use Case
 *
 * REQ-BILL-5: List refund requests with filtering
 */

import { PrismaClient } from '@prisma/client';
import type { RefundStatus } from '../../../shared/types/prisma-enums.ts';;

export interface GetRefundRequestsFilters {
  status?: RefundStatus;
  invoiceId?: string;
  patientId?: string;
  limit?: number;
  offset?: number;
}

export class GetRefundRequestsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, filters: GetRefundRequestsFilters = {}) {
    const where: any = { tenantId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.invoiceId) {
      where.invoiceId = filters.invoiceId;
    }

    if (filters.patientId) {
      where.patientId = filters.patientId;
    }

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              totalAmount: true
            }
          },
          payment: {
            select: {
              paymentNumber: true,
              amount: true
            }
          },
          patient: {
            select: {
              patientId: true,
              firstName: true,
              lastName: true
            }
          },
          requestedBy: {
            select: {
              firstName: true,
              lastName: true,
              role: true
            }
          },
          approvedBy: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          rejectedBy: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { requestedAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0
      }),
      this.prisma.refund.count({ where })
    ]);

    return {
      refunds,
      total,
      limit: filters.limit || 50,
      offset: filters.offset || 0
    };
  }
}
