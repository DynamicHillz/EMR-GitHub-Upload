/**
 * Get Invoice Details Use Case
 *
 * REQ-BILL-1: Get single invoice with full details
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../shared/errors/AppError';

export class GetInvoiceDetailsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(invoiceId: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId
      },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            address: true
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
            paymentNumber: true,
            amount: true,
            paymentDate: true,
            paymentMethod: true,
            referenceNumber: true,
            status: true,
            processedBy: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: {
            paymentDate: 'desc'
          }
        },
        refunds: {
          select: {
            id: true,
            refundNumber: true,
            amount: true,
            reason: true,
            status: true,
            requestedAt: true,
            approvedAt: true
          }
        }
      }
    });

    if (!invoice) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    return {
      ...invoice,
      lineItems: JSON.parse(invoice.lineItems)
    };
  }
}
