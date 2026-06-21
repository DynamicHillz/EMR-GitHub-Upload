/**
 * Verify Gateway Payment Use Case
 *
 * REQ-BILL-7: Verify payment via payment gateway and update invoice
 * Supports multiple payment processors
 */

import { PrismaClient } from '@prisma/client';
import { PaymentGatewayFactory } from '../../../infrastructure/payment-gateways/payment-gateway.factory';
import { PaymentGatewayProvider } from '../../../infrastructure/payment-gateways/types';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export class VerifyGatewayPaymentUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(paymentReference: string, tenantId: string) {
    // Find pending payment
    const payment = await this.prisma.payment.findFirst({
      where: {
        paymentNumber: paymentReference,
        tenantId,
      },
      include: {
        invoice: true,
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment', paymentReference);
    }

    if (payment.status !== 'PENDING') {
      // Payment already processed
      return {
        payment,
        invoice: payment.invoice,
        alreadyProcessed: true,
      };
    }

    if (!payment.gatewayProvider || !payment.gatewayRef) {
      throw new ValidationError('Payment gateway information missing');
    }

    // Get payment gateway
    const gatewayConfig = PaymentGatewayFactory.getConfigFromEnv(
      payment.gatewayProvider as PaymentGatewayProvider
    );
    const gateway = PaymentGatewayFactory.getGateway(
      payment.gatewayProvider as PaymentGatewayProvider,
      gatewayConfig
    );

    // Verify payment
    const verification = await gateway.verifyPayment({
      reference: paymentReference,
      gatewayRef: payment.gatewayRef,
    });

    if (!verification.success || verification.status !== 'successful') {
      // Update payment as failed
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          gatewayStatus: verification.status,
          gatewayData: verification.gatewayData,
        },
      });

      throw new ValidationError(
        verification.message || 'Payment verification failed'
      );
    }

    // Update payment as completed
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        paymentDate: verification.paidAt || new Date(),
        cardLast4: verification.cardLast4,
        cardBrand: verification.cardBrand,
        gatewayStatus: verification.status,
        gatewayData: verification.gatewayData,
      },
    });

    // Update invoice
    const invoice = payment.invoice;
    const newPaidAmount = invoice.paidAmount + payment.amount;
    const newBalance = invoice.totalAmount - newPaidAmount;

    let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
    if (newBalance === 0) {
      paymentStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    } else {
      paymentStatus = 'UNPAID';
    }

    const updatedInvoice = await this.prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        paidAmount: newPaidAmount,
        balance: newBalance,
        paymentStatus,
        status: paymentStatus === 'PAID' ? 'PAID' : invoice.status,
      },
    });

    return {
      payment: updatedPayment,
      invoice: updatedInvoice,
      alreadyProcessed: false,
    };
  }
}
