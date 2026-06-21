/**
 * Initiate Gateway Payment Use Case
 *
 * REQ-BILL-7: Initiate payment via payment gateway
 * Supports multiple payment processors (Flutterwave, Paystack, Stripe, etc.)
 */

import { PrismaClient } from '@prisma/client';
import {
  PaymentGatewayFactory,
  PaymentGatewayProvider,
} from '../../../infrastructure/payment-gateways/payment-gateway.factory';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export interface InitiateGatewayPaymentDto {
  invoiceId: string;
  amount: number;
  gateway: PaymentGatewayProvider;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  callbackUrl?: string;
  redirectUrl?: string;
}

export class InitiateGatewayPaymentUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: InitiateGatewayPaymentDto, tenantId: string) {
    // Validate invoice
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: dto.invoiceId,
        tenantId,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice', dto.invoiceId);
    }

    if (invoice.status === 'CANCELLED') {
      throw new ValidationError('Cannot pay a cancelled invoice');
    }

    // Validate payment amount
    if (dto.amount <= 0) {
      throw new ValidationError('Payment amount must be greater than zero');
    }

    if (dto.amount > invoice.balance) {
      throw new ValidationError(
        `Payment amount (₦${dto.amount}) exceeds invoice balance (₦${invoice.balance})`
      );
    }

    // Generate payment reference
    const paymentRef = await this.generatePaymentReference(tenantId);

    // Get payment gateway
    const gatewayConfig = PaymentGatewayFactory.getConfigFromEnv(dto.gateway);
    const gateway = PaymentGatewayFactory.getGateway(dto.gateway, gatewayConfig);

    // Initiate payment
    const result = await gateway.initiatePayment({
      amount: dto.amount,
      currency: 'NGN',
      customerEmail: dto.customerEmail || invoice.patient.email || '',
      customerName: dto.customerName || `${invoice.patient.firstName} ${invoice.patient.lastName}`,
      customerPhone: dto.customerPhone || invoice.patient.phone || undefined,
      reference: paymentRef,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        patientId: invoice.patientId,
        tenantId,
      },
      callbackUrl: dto.callbackUrl,
      redirectUrl: dto.redirectUrl,
    });

    if (!result.success) {
      throw new ValidationError(result.message || 'Failed to initiate payment');
    }

    // Create pending payment record
    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        patientId: invoice.patientId,
        processedById: tenantId, // System-initiated, will be updated on verification
        paymentNumber: paymentRef,
        amount: dto.amount,
        paymentMethod: 'CARD', // Default to card, will be updated on verification
        status: 'PENDING',
        gatewayProvider: dto.gateway,
        gatewayRef: result.gatewayRef,
        gatewayData: result.data,
      },
    });

    return {
      payment,
      paymentUrl: result.paymentUrl,
      reference: paymentRef,
      gatewayRef: result.gatewayRef,
    };
  }

  private async generatePaymentReference(tenantId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `PAY-${year}${month}${day}`;

    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await this.prisma.payment.count({
      where: {
        tenantId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `${datePrefix}-${sequence}`;
  }
}
