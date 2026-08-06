/**
 * Refund Processing Integration Tests
 *
 * Tests the complete refund processing flow including database transactions
 * Verifies REQ-BILL-5: Complete approved refund and update invoice
 */

import { PrismaClient } from '@prisma/client';
import { ProcessRefundUseCase } from '../../application/use-cases/billing/process-refund.use-case';
import { RecordPaymentUseCase } from '../../application/use-cases/billing/record-payment.use-case';
import { ProcessRefundDto } from '../../application/dtos/billing/ProcessRefund.dto';
import { RecordPaymentDto } from '../../application/dtos/billing/RecordPayment.dto';
import {
  createTestPrisma,
  createTestTenant,
  createTestUser,
  createTestPatient,
  createTestInvoice,
  cleanDatabase,
} from '../helpers/test-helpers';

describe('Refund Processing Integration', () => {
  let prisma: PrismaClient;
  let processRefundUseCase: ProcessRefundUseCase;
  let recordPaymentUseCase: RecordPaymentUseCase;
  let tenantId: string;
  let cashierId: string;
  let patientId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();

    // Create test data
    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    const cashier = await createTestUser(prisma, tenantId, {
      role: 'CASHIER',
      email: 'cashier@test.com',
    });
    cashierId = cashier.id;

    const patient = await createTestPatient(prisma, tenantId);
    patientId = patient.id;

    processRefundUseCase = new ProcessRefundUseCase(prisma);
    recordPaymentUseCase = new RecordPaymentUseCase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma, tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  describe('Full Refund Flow', () => {
    it('should process full refund and update invoice to REFUNDED status', async () => {
      // Arrange - Create invoice and payment
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        {
          id: '1',
          description: 'Consultation Fee',
          quantity: 1,
          unitPrice: 5000,
          amount: 5000,
        },
      ]);

      // Record payment
      const payment = await recordPaymentUseCase.execute(
        {
          invoiceId: invoice.id,
          amount: 5000,
          paymentMethod: 'CASH',
          cashReceivedByName: 'Bisi Adeyemi',
        },
        tenantId,
        cashierId
      );

      // Create approved refund
      const refund = await prisma.refund.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          patientId,
          paymentId: payment.payment.id,
          amount: 5000,
          reason: 'Service not rendered',
          requestedById: cashierId,
          approvedById: cashierId,
          status: 'APPROVED',
          refundNumber: 'REF-001',
          refundMethod: 'CASH',
        },
      });

      const refundDto: ProcessRefundDto = {
        referenceNumber: 'BANK-REF-123',
      };

      // Act
      const result = await processRefundUseCase.execute(refund.id, refundDto, tenantId);

      // Assert - Refund completed
      expect(result.refund.status).toBe('COMPLETED');
      expect(result.refund.referenceNumber).toBe('BANK-REF-123');
      expect(result.refund.refundDate).toBeDefined();

      // Assert - Invoice updated to REFUNDED
      expect(Number(result.invoice.paidAmount)).toBe(0);
      expect(Number(result.invoice.balance)).toBe(5000);
      expect(result.invoice.paymentStatus).toBe('REFUNDED');
      expect(result.invoice.status).toBe('REFUNDED');

      // Verify payment updated
      const dbPayment = await prisma.payment.findUnique({
        where: { id: payment.payment.id },
      });
      expect(dbPayment?.status).toBe('REFUNDED');

      // Verify in database
      const dbInvoice = await prisma.invoice.findUnique({
        where: { id: invoice.id },
        include: { refunds: true, payments: true },
      });

      expect(Number(dbInvoice?.paidAmount)).toBe(0);
      expect(Number(dbInvoice?.balance)).toBe(5000);
      expect(dbInvoice?.paymentStatus).toBe('REFUNDED');
      expect(dbInvoice?.refunds).toHaveLength(1);
      expect(dbInvoice?.refunds[0].status).toBe('COMPLETED');
    });
  });

  describe('Partial Refund Flow', () => {
    it('should process partial refund and update invoice to PARTIALLY_PAID', async () => {
      // Arrange - Create invoice with full payment
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        {
          id: '2',
          description: 'Lab Tests',
          quantity: 1,
          unitPrice: 10000,
          amount: 10000,
        },
      ]);

      // Record payment
      const payment = await recordPaymentUseCase.execute(
        {
          invoiceId: invoice.id,
          amount: 10000,
          paymentMethod: 'CARD',
        },
        tenantId,
        cashierId
      );

      // Create approved partial refund (3000 out of 10000)
      const refund = await prisma.refund.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          patientId,
          paymentId: payment.payment.id,
          amount: 3000,
          reason: 'One test cancelled',
          requestedById: cashierId,
          approvedById: cashierId,
          status: 'APPROVED',
          refundNumber: 'REF-002',
          refundMethod: 'CASH',
        },
      });

      const refundDto: ProcessRefundDto = {
        referenceNumber: 'CARD-REFUND-456',
      };

      // Act
      const result = await processRefundUseCase.execute(refund.id, refundDto, tenantId);

      // Assert - Refund completed
      expect(result.refund.status).toBe('COMPLETED');
      expect(Number(result.refund.amount)).toBe(3000);

      // Assert - Invoice partially paid
      expect(Number(result.invoice.paidAmount)).toBe(7000);
      expect(Number(result.invoice.balance)).toBe(3000);
      expect(result.invoice.paymentStatus).toBe('PARTIALLY_PAID');
      expect(result.invoice.status).toBe('PARTIALLY_PAID');

      // Verify in database
      const dbInvoice = await prisma.invoice.findUnique({
        where: { id: invoice.id },
      });

      expect(Number(dbInvoice?.paidAmount)).toBe(7000);
      expect(Number(dbInvoice?.balance)).toBe(3000);
      expect(dbInvoice?.paymentStatus).toBe('PARTIALLY_PAID');
    });
  });

  describe('Multiple Payments Refund Flow', () => {
    it('should handle refund when invoice has multiple payments', async () => {
      // Arrange - Create invoice
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        {
          id: '3',
          description: 'Multiple Services',
          quantity: 1,
          unitPrice: 15000,
          amount: 15000,
        },
      ]);

      // Record multiple payments
      const payment1 = await recordPaymentUseCase.execute(
        {
          invoiceId: invoice.id,
          amount: 10000,
          paymentMethod: 'CASH',
          cashReceivedByName: 'Bisi Adeyemi',
        },
        tenantId,
        cashierId
      );

      const payment2 = await recordPaymentUseCase.execute(
        {
          invoiceId: invoice.id,
          amount: 5000,
          paymentMethod: 'CARD',
        },
        tenantId,
        cashierId
      );

      // Create approved refund for second payment only
      const refund = await prisma.refund.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          patientId,
          paymentId: payment2.payment.id,
          amount: 5000,
          reason: 'Duplicate payment',
          requestedById: cashierId,
          approvedById: cashierId,
          status: 'APPROVED',
          refundNumber: 'REF-003',
          refundMethod: 'CASH',
        },
      });

      const refundDto: ProcessRefundDto = {
        referenceNumber: 'DUPLICATE-REF',
      };

      // Act
      const result = await processRefundUseCase.execute(refund.id, refundDto, tenantId);

      // Assert
      expect(Number(result.invoice.paidAmount)).toBe(10000);
      expect(Number(result.invoice.balance)).toBe(5000);
      expect(result.invoice.paymentStatus).toBe('PARTIALLY_PAID');

      // Verify only the refunded payment is marked REFUNDED
      const dbPayment1 = await prisma.payment.findUnique({
        where: { id: payment1.payment.id },
      });
      const dbPayment2 = await prisma.payment.findUnique({
        where: { id: payment2.payment.id },
      });

      expect(dbPayment1?.status).toBe('COMPLETED');
      expect(dbPayment2?.status).toBe('REFUNDED');
    });
  });

  describe('Refund Without Specific Payment', () => {
    it('should process refund without paymentId (general refund)', async () => {
      // Arrange - Create invoice with payment
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        {
          id: '4',
          description: 'Service',
          quantity: 1,
          unitPrice: 8000,
          amount: 8000,
        },
      ]);

      await recordPaymentUseCase.execute(
        {
          invoiceId: invoice.id,
          amount: 8000,
          paymentMethod: 'CASH',
          cashReceivedByName: 'Bisi Adeyemi',
        },
        tenantId,
        cashierId
      );

      // Create approved refund without specific paymentId
      const refund = await prisma.refund.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          patientId,
          paymentId: null, // No specific payment
          amount: 2000,
          reason: 'Discount applied retroactively',
          requestedById: cashierId,
          approvedById: cashierId,
          status: 'APPROVED',
          refundNumber: 'REF-004',
          refundMethod: 'CASH',
        },
      });

      const refundDto: ProcessRefundDto = {
        referenceNumber: 'DISCOUNT-REF',
      };

      // Act
      const result = await processRefundUseCase.execute(refund.id, refundDto, tenantId);

      // Assert
      expect(result.refund.status).toBe('COMPLETED');
      expect(Number(result.invoice.paidAmount)).toBe(6000);
      expect(Number(result.invoice.balance)).toBe(2000);
      expect(result.invoice.paymentStatus).toBe('PARTIALLY_PAID');
    });
  });

  describe('Transaction Atomicity', () => {
    it('should rollback all changes if refund processing fails', async () => {
      // Arrange - Create refund that is not APPROVED (should fail)
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        {
          id: '5',
          description: 'Test',
          quantity: 1,
          unitPrice: 5000,
          amount: 5000,
        },
      ]);

      const payment = await recordPaymentUseCase.execute(
        {
          invoiceId: invoice.id,
          amount: 5000,
          paymentMethod: 'CASH',
          cashReceivedByName: 'Bisi Adeyemi',
        },
        tenantId,
        cashierId
      );

      const pendingRefund = await prisma.refund.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          patientId,
          paymentId: payment.payment.id,
          amount: 5000,
          reason: 'Test refund',
          requestedById: cashierId,
          status: 'PENDING', // Not approved!
          refundNumber: 'REF-005',
          refundMethod: 'CASH',
        },
      });

      const refundDto: ProcessRefundDto = {
        referenceNumber: 'SHOULD-FAIL',
      };

      // Act & Assert
      await expect(
        processRefundUseCase.execute(pendingRefund.id, refundDto, tenantId)
      ).rejects.toThrow('Refund must be approved before processing');

      // Verify nothing changed in database
      const dbInvoice = await prisma.invoice.findUnique({
        where: { id: invoice.id },
      });
      const dbRefund = await prisma.refund.findUnique({
        where: { id: pendingRefund.id },
      });
      const dbPayment = await prisma.payment.findUnique({
        where: { id: payment.payment.id },
      });

      expect(Number(dbInvoice?.paidAmount)).toBe(5000);
      expect(Number(dbInvoice?.balance)).toBe(0);
      expect(dbInvoice?.paymentStatus).toBe('PAID');
      expect(dbRefund?.status).toBe('PENDING');
      expect(dbPayment?.status).toBe('COMPLETED');
    });
  });

  describe('Edge Cases', () => {
    it('should handle refund with reference number', async () => {
      // Arrange
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { id: '6', description: 'Test', quantity: 1, unitPrice: 3000, amount: 3000 },
      ]);

      const payment = await recordPaymentUseCase.execute(
        {
          invoiceId: invoice.id,
          amount: 3000,
          paymentMethod: 'BANK_TRANSFER',
        },
        tenantId,
        cashierId
      );

      const refund = await prisma.refund.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          patientId,
          paymentId: payment.payment.id,
          amount: 3000,
          reason: 'Bank error',
          requestedById: cashierId,
          approvedById: cashierId,
          status: 'APPROVED',
          refundNumber: 'REF-006',
          refundMethod: 'CASH',
        },
      });

      // Act
      const result = await processRefundUseCase.execute(
        refund.id,
        { referenceNumber: 'BANK-REVERSAL-789' },
        tenantId
      );

      // Assert
      expect(result.refund.referenceNumber).toBe('BANK-REVERSAL-789');
      expect(result.refund.refundDate).toBeDefined();

      // Verify in database
      const dbRefund = await prisma.refund.findUnique({
        where: { id: refund.id },
      });
      expect(dbRefund?.referenceNumber).toBe('BANK-REVERSAL-789');
      expect(dbRefund?.refundDate).toBeDefined();
    });

    it('should handle refund without reference number', async () => {
      // Arrange
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { id: '7', description: 'Test', quantity: 1, unitPrice: 2000, amount: 2000 },
      ]);

      const payment = await recordPaymentUseCase.execute(
        {
          invoiceId: invoice.id,
          amount: 2000,
          paymentMethod: 'CASH',
          cashReceivedByName: 'Bisi Adeyemi',
        },
        tenantId,
        cashierId
      );

      const refund = await prisma.refund.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          patientId,
          paymentId: payment.payment.id,
          amount: 2000,
          reason: 'Cash refund',
          requestedById: cashierId,
          approvedById: cashierId,
          status: 'APPROVED',
          refundNumber: 'REF-007',
          refundMethod: 'CASH',
        },
      });

      // Act - No reference number provided
      const result = await processRefundUseCase.execute(refund.id, {}, tenantId);

      // Assert
      expect(result.refund.status).toBe('COMPLETED');
      expect(result.refund.referenceNumber).toBeNull();
    });
  });
});
