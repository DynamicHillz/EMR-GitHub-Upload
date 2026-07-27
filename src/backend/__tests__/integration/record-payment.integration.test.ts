/**
 * Record Payment Integration Tests
 *
 * Covers RecordPaymentUseCase's fraud-prevention integration and
 * amount-validation rules — the money-critical gate every cashier payment
 * passes through before an invoice balance changes.
 */

import { PrismaClient } from '@prisma/client';
import { RecordPaymentUseCase } from '../../application/use-cases/billing/record-payment.use-case';
import { RecordPaymentDto } from '../../application/dtos/billing/RecordPayment.dto';
import {
  createTestPrisma,
  createTestTenant,
  createTestUser,
  createTestPatient,
  createTestInvoice,
  cleanDatabase,
} from '../helpers/test-helpers';

describe('Record Payment Integration', () => {
  let prisma: PrismaClient;
  let useCase: RecordPaymentUseCase;
  let tenantId: string;
  let cashierId: string;
  let patientId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    const cashier = await createTestUser(prisma, tenantId, {
      role: 'CASHIER',
      email: 'cashier-rp@test.com',
    });
    cashierId = cashier.id;

    const patient = await createTestPatient(prisma, tenantId);
    patientId = patient.id;

    useCase = new RecordPaymentUseCase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma, tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  describe('Amount validation', () => {
    it('should reject a payment amount that exceeds the invoice balance', async () => {
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { description: 'Consultation', quantity: 1, unitPrice: 3000, amount: 3000 },
      ]);

      const dto: RecordPaymentDto = { invoiceId: invoice.id, amount: 5000, paymentMethod: 'CARD' };

      await expect(useCase.execute(dto, tenantId, cashierId)).rejects.toThrow(
        'exceeds invoice balance'
      );

      const dbInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(Number(dbInvoice?.paidAmount)).toBe(0);
    });

    it('should reject a zero or negative amount', async () => {
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { description: 'Consultation', quantity: 1, unitPrice: 3000, amount: 3000 },
      ]);

      await expect(
        useCase.execute({ invoiceId: invoice.id, amount: 0, paymentMethod: 'CARD' }, tenantId, cashierId)
      ).rejects.toThrow('valid positive number');

      await expect(
        useCase.execute({ invoiceId: invoice.id, amount: -100, paymentMethod: 'CARD' }, tenantId, cashierId)
      ).rejects.toThrow('valid positive number');
    });

    it('should reject a NaN amount instead of letting it silently pass the <= 0 check', async () => {
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { description: 'Consultation', quantity: 1, unitPrice: 3000, amount: 3000 },
      ]);

      await expect(
        useCase.execute(
          { invoiceId: invoice.id, amount: NaN, paymentMethod: 'CARD' },
          tenantId,
          cashierId
        )
      ).rejects.toThrow('valid positive number');
    });

    it('should reject payment against a cancelled invoice', async () => {
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { description: 'Consultation', quantity: 1, unitPrice: 3000, amount: 3000 },
      ]);
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'CANCELLED' } });

      await expect(
        useCase.execute({ invoiceId: invoice.id, amount: 1000, paymentMethod: 'CASH' }, tenantId, cashierId)
      ).rejects.toThrow('Cannot pay a cancelled invoice');
    });

    it('should throw NotFoundError for an invoice belonging to another tenant', async () => {
      const otherTenant = await createTestTenant(prisma);
      const otherUser = await createTestUser(prisma, otherTenant.id, { role: 'CASHIER' });
      const otherPatient = await createTestPatient(prisma, otherTenant.id);
      const otherInvoice = await createTestInvoice(prisma, otherTenant.id, otherPatient.id, otherUser.id);

      await expect(
        useCase.execute({ invoiceId: otherInvoice.id, amount: 1000, paymentMethod: 'CASH' }, tenantId, cashierId)
      ).rejects.toThrow();

      await cleanDatabase(prisma, otherTenant.id);
      await prisma.tenant.delete({ where: { id: otherTenant.id } });
    });
  });

  describe('Fraud prevention: approval thresholds', () => {
    it('should require an approver name once the cash approval threshold is met, and reject without one', async () => {
      // Default FraudPreventionSettings from createTestTenant leaves
      // cashApprovalThreshold at its schema default (50000).
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { description: 'Procedure', quantity: 1, unitPrice: 60000, amount: 60000 },
      ]);

      await expect(
        useCase.execute({ invoiceId: invoice.id, amount: 60000, paymentMethod: 'CASH' }, tenantId, cashierId)
      ).rejects.toThrow('requires an approver name');

      // Invoice must be untouched by the rejected attempt
      const dbInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(Number(dbInvoice?.paidAmount)).toBe(0);
    });

    it('should accept the same large cash payment once an approver name is supplied', async () => {
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { description: 'Procedure', quantity: 1, unitPrice: 60000, amount: 60000 },
      ]);

      const result = await useCase.execute(
        { invoiceId: invoice.id, amount: 60000, paymentMethod: 'CASH', approverName: 'Dr. Adaeze' },
        tenantId,
        cashierId
      );

      expect(result.fraudPrevention.requiresApproval).toBe(true);
      expect(result.invoice.paymentStatus).toBe('PAID');

      const dbInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
      expect(Number(dbInvoice?.paidAmount)).toBe(60000);
    });

    it('should not require approval for a CARD payment of the same amount (no threshold configured for CARD)', async () => {
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { description: 'Procedure', quantity: 1, unitPrice: 60000, amount: 60000 },
      ]);

      const result = await useCase.execute(
        { invoiceId: invoice.id, amount: 60000, paymentMethod: 'CARD' },
        tenantId,
        cashierId
      );

      expect(result.fraudPrevention.requiresApproval).toBe(false);
    });
  });

  describe('Concurrency safety', () => {
    it('should not lose an update when two payments are recorded concurrently on the same invoice', async () => {
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { description: 'Ward stay', quantity: 1, unitPrice: 20000, amount: 20000 },
      ]);

      // Two concurrent 10,000 payments against a 20,000 balance — if the
      // optimistic-concurrency guard in RecordPaymentUseCase were broken,
      // one payment's contribution to paidAmount would be silently lost.
      const [r1, r2] = await Promise.all([
        useCase.execute({ invoiceId: invoice.id, amount: 10000, paymentMethod: 'CARD' }, tenantId, cashierId),
        useCase.execute(
          { invoiceId: invoice.id, amount: 10000, paymentMethod: 'BANK_TRANSFER', referenceNumber: 'REF-1' },
          tenantId,
          cashierId
        ),
      ]);

      expect(r1.payment.id).not.toBe(r2.payment.id);

      const dbInvoice = await prisma.invoice.findUnique({
        where: { id: invoice.id },
        include: { payments: true },
      });

      expect(dbInvoice?.payments).toHaveLength(2);
      expect(Number(dbInvoice?.paidAmount)).toBe(20000);
      expect(Number(dbInvoice?.balance)).toBe(0);
      expect(dbInvoice?.paymentStatus).toBe('PAID');
    });
  });
});
