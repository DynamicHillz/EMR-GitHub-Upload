/**
 * Gateway Payment Integration Tests
 *
 * Covers InitiateGatewayPaymentUseCase / VerifyGatewayPaymentUseCase — the
 * external-gateway trust boundary. The actual gateway HTTP call
 * (Flutterwave/Paystack/Moniepoint) is mocked via PaymentGatewayFactory so
 * these tests exercise our own DB/transaction logic, not a third party.
 */

import { PrismaClient } from '@prisma/client';
import { InitiateGatewayPaymentUseCase } from '../../application/use-cases/billing/initiate-gateway-payment.use-case';
import { VerifyGatewayPaymentUseCase } from '../../application/use-cases/billing/verify-gateway-payment.use-case';
import { PaymentGatewayFactory } from '../../infrastructure/payment-gateways/payment-gateway.factory';
import {
  createTestPrisma,
  createTestTenant,
  createTestUser,
  createTestPatient,
  createTestInvoice,
  cleanDatabase,
} from '../helpers/test-helpers';

describe('Gateway Payment Integration', () => {
  let prisma: PrismaClient;
  let initiateUseCase: InitiateGatewayPaymentUseCase;
  let verifyUseCase: VerifyGatewayPaymentUseCase;
  let tenantId: string;
  let cashierId: string;
  let patientId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    const cashier = await createTestUser(prisma, tenantId, { role: 'CASHIER', email: 'cashier-gw@test.com' });
    cashierId = cashier.id;

    const patient = await createTestPatient(prisma, tenantId, { phone: '+2348055500000' });
    patientId = patient.id;

    initiateUseCase = new InitiateGatewayPaymentUseCase(prisma);
    verifyUseCase = new VerifyGatewayPaymentUseCase(prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanDatabase(prisma, tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  describe('Initiate', () => {
    it('should create a PENDING payment record and return the gateway payment URL', async () => {
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { description: 'Consultation', quantity: 1, unitPrice: 5000, amount: 5000 },
      ]);

      jest.spyOn(PaymentGatewayFactory, 'getGateway').mockReturnValue({
        name: 'PAYSTACK',
        initiatePayment: jest.fn().mockResolvedValue({
          success: true,
          paymentUrl: 'https://paystack.test/pay/abc123',
          reference: 'PAY-TEST',
          gatewayRef: 'gw-ref-abc123',
        }),
        verifyPayment: jest.fn(),
        refundPayment: jest.fn(),
        verifyWebhookSignature: jest.fn(),
        parseWebhookEvent: jest.fn(),
      } as any);

      const result = await initiateUseCase.execute(
        {
          invoiceId: invoice.id,
          amount: 5000,
          gateway: 'PAYSTACK',
          customerEmail: 'patient@test.com',
          customerName: 'Test Patient',
        },
        tenantId,
        cashierId
      );

      expect(result.paymentUrl).toBe('https://paystack.test/pay/abc123');
      expect(result.payment.status).toBe('PENDING');

      const dbPayment = await prisma.payment.findUnique({ where: { id: result.payment.id } });
      expect(dbPayment?.status).toBe('PENDING');
      expect(dbPayment?.gatewayProvider).toBe('PAYSTACK');
    });

    it('should reject initiating a payment that exceeds the invoice balance', async () => {
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { description: 'Consultation', quantity: 1, unitPrice: 3000, amount: 3000 },
      ]);

      await expect(
        initiateUseCase.execute(
          {
            invoiceId: invoice.id,
            amount: 5000,
            gateway: 'PAYSTACK',
            customerEmail: 'patient@test.com',
            customerName: 'Test Patient',
          },
          tenantId,
          cashierId
        )
      ).rejects.toThrow('exceeds invoice balance');
    });
  });

  describe('Verify', () => {
    async function createPendingGatewayPayment(invoiceAmount: number, payAmount: number) {
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { description: 'Service', quantity: 1, unitPrice: invoiceAmount, amount: invoiceAmount },
      ]);
      const payment = await prisma.payment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          patientId,
          processedById: cashierId,
          paymentNumber: `PAY-VERIFY-${invoice.id.slice(0, 8)}`,
          amount: payAmount,
          paymentMethod: 'CARD',
          status: 'PENDING',
          gatewayProvider: 'PAYSTACK',
          gatewayRef: `gw-${invoice.id.slice(0, 8)}`,
        },
      });
      return { invoice, payment };
    }

    it('should mark payment COMPLETED and credit the invoice on a successful verification', async () => {
      const { invoice, payment } = await createPendingGatewayPayment(8000, 8000);

      jest.spyOn(PaymentGatewayFactory, 'getGateway').mockReturnValue({
        name: 'PAYSTACK',
        initiatePayment: jest.fn(),
        verifyPayment: jest.fn().mockResolvedValue({
          success: true,
          status: 'successful',
          amount: 8000,
          currency: 'NGN',
          reference: payment.paymentNumber,
          gatewayRef: payment.gatewayRef,
          paidAt: new Date(),
        }),
        refundPayment: jest.fn(),
        verifyWebhookSignature: jest.fn(),
        parseWebhookEvent: jest.fn(),
      } as any);

      const result = await verifyUseCase.execute(payment.paymentNumber, tenantId);

      expect(result.alreadyProcessed).toBe(false);
      expect(result.payment.status).toBe('COMPLETED');

      const dbInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(Number(dbInvoice?.paidAmount)).toBe(8000);
      expect(dbInvoice?.paymentStatus).toBe('PAID');
    });

    it('should mark payment FAILED and leave the invoice untouched on a failed verification', async () => {
      const { invoice, payment } = await createPendingGatewayPayment(4000, 4000);

      jest.spyOn(PaymentGatewayFactory, 'getGateway').mockReturnValue({
        name: 'PAYSTACK',
        initiatePayment: jest.fn(),
        verifyPayment: jest.fn().mockResolvedValue({
          success: false,
          status: 'failed',
          amount: 4000,
          currency: 'NGN',
          reference: payment.paymentNumber,
          gatewayRef: payment.gatewayRef,
          message: 'Card declined',
        }),
        refundPayment: jest.fn(),
        verifyWebhookSignature: jest.fn(),
        parseWebhookEvent: jest.fn(),
      } as any);

      await expect(verifyUseCase.execute(payment.paymentNumber, tenantId)).rejects.toThrow(
        'Card declined'
      );

      const dbPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(dbPayment?.status).toBe('FAILED');

      const dbInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(Number(dbInvoice?.paidAmount)).toBe(0);
    });

    it('should not double-credit the invoice when verification races (webhook + client poll)', async () => {
      const { invoice, payment } = await createPendingGatewayPayment(6000, 6000);

      jest.spyOn(PaymentGatewayFactory, 'getGateway').mockReturnValue({
        name: 'PAYSTACK',
        initiatePayment: jest.fn(),
        verifyPayment: jest.fn().mockResolvedValue({
          success: true,
          status: 'successful',
          amount: 6000,
          currency: 'NGN',
          reference: payment.paymentNumber,
          gatewayRef: payment.gatewayRef,
          paidAt: new Date(),
        }),
        refundPayment: jest.fn(),
        verifyWebhookSignature: jest.fn(),
        parseWebhookEvent: jest.fn(),
      } as any);

      // Two concurrent verification calls for the same pending payment,
      // simulating a client-side poll racing a gateway webhook retry.
      const [r1, r2] = await Promise.all([
        verifyUseCase.execute(payment.paymentNumber, tenantId),
        verifyUseCase.execute(payment.paymentNumber, tenantId),
      ]);

      // Exactly one call should have actually applied the credit.
      const alreadyProcessedFlags = [r1.alreadyProcessed, r2.alreadyProcessed].sort();
      expect(alreadyProcessedFlags).toEqual([false, true]);

      const dbInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(Number(dbInvoice?.paidAmount)).toBe(6000);
      expect(dbInvoice?.paymentStatus).toBe('PAID');
    });

    it('should return alreadyProcessed for a payment that is no longer PENDING, without touching the invoice again', async () => {
      const { invoice, payment } = await createPendingGatewayPayment(2000, 2000);
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'COMPLETED' } });

      const result = await verifyUseCase.execute(payment.paymentNumber, tenantId);

      expect(result.alreadyProcessed).toBe(true);

      const dbInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(Number(dbInvoice?.paidAmount)).toBe(0); // untouched — verify never re-applies the credit
    });
  });
});
