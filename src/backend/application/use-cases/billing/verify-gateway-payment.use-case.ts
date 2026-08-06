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

    // Cross-check the gateway's own verified amount against what we expected
    // (bounded by invoice.balance at initiation) before crediting anything.
    // Not concretely exploitable today — Flutterwave/Paystack/Moniepoint all
    // fix the amount at checkout initialization and /verify takes no
    // client-supplied amount — but that's a property of current gateway
    // behavior, not something this code asserted for itself.
    const amountMismatch =
      verification.success &&
      verification.status === 'successful' &&
      Math.abs(verification.amount - Number(payment.amount)) > 0.01;

    if (!verification.success || verification.status !== 'successful' || amountMismatch) {
      // Guarded the same way as the success path below — if a concurrent
      // call already resolved this payment, don't stomp on its result.
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: 'FAILED',
          gatewayStatus: verification.status,
          gatewayData: verification.gatewayData,
        },
      });

      if (amountMismatch) {
        throw new ValidationError(
          `Payment verification amount mismatch: gateway reports ${verification.amount}, expected ${payment.amount}. Payment marked FAILED — flag for manual review before retrying.`
        );
      }

      throw new ValidationError(
        verification.message || 'Payment verification failed'
      );
    }

    // This is the real concurrency guard: a client-side poll and a gateway
    // webhook retry can both reach this point concurrently for the same
    // payment reference. Only one PENDING->COMPLETED transition can win;
    // the other treats itself as already-processed instead of re-applying
    // the invoice credit a second time.
    const result = await this.prisma.$transaction(async (tx) => {
      const paymentUpdateResult = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: 'COMPLETED',
          paymentDate: verification.paidAt || new Date(),
          cardLast4: verification.cardLast4,
          cardBrand: verification.cardBrand,
          gatewayStatus: verification.status,
          gatewayData: verification.gatewayData,
        },
      });

      if (paymentUpdateResult.count === 0) {
        // Lost the race — someone else already completed this payment.
        const latestPayment = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
        const latestInvoice = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
        return { payment: latestPayment, invoice: latestInvoice, alreadyProcessed: true };
      }

      const current = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
      const newPaidAmount = Number(current.paidAmount) + Number(payment.amount);
      // current.balance, not totalAmount — see record-payment.use-case.ts:
      // totalAmount includes any insurance-covered portion the patient never
      // owed, so deriving from it here would silently reintroduce that
      // amount as still outstanding.
      const newBalance = Number(current.balance) - Number(payment.amount);

      let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
      if (newBalance === 0) {
        paymentStatus = 'PAID';
      } else if (newPaidAmount > 0) {
        paymentStatus = 'PARTIALLY_PAID';
      } else {
        paymentStatus = 'UNPAID';
      }

      const invoiceUpdateResult = await tx.invoice.updateMany({
        where: { id: payment.invoiceId, paidAmount: current.paidAmount },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          paymentStatus,
          status: paymentStatus === 'PAID' ? 'PAID' : current.status,
        },
      });

      if (invoiceUpdateResult.count === 0) {
        throw new ValidationError('This invoice was modified concurrently — please retry verification.');
      }

      const updatedPayment = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      const updatedInvoice = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
      return { payment: updatedPayment, invoice: updatedInvoice, alreadyProcessed: false };
    });

    return result;
  }
}
