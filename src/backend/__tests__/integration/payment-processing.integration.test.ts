/**
 * Payment Processing Integration Tests
 *
 * Tests the complete payment processing flow including database transactions
 * Verifies REQ-BILL-2: Record payments and REQ-BILL-3: Generate receipts
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

describe('Payment Processing Integration', () => {
  let prisma: PrismaClient;
  let useCase: RecordPaymentUseCase;
  let tenantId: string;
  let cashierId: string;
  let patientId: string;
  let invoiceId: string;

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

    const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
      {
        id: '1',
        description: 'Consultation Fee',
        quantity: 1,
        unitPrice: 10000,
        amount: 10000,
      },
    ]);
    invoiceId = invoice.id;

    useCase = new RecordPaymentUseCase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma, tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  describe('Full Payment Flow', () => {
    it('should process full payment and update invoice status to PAID', async () => {
      // Arrange
      const paymentDto: RecordPaymentDto = {
        invoiceId,
        amount: 10000,
        paymentMethod: 'CASH',
        paymentDate: new Date(),
        notes: 'Full payment in cash',
        cashReceivedByName: 'Bisi Adeyemi',
      };

      // Act
      const result = await useCase.execute(paymentDto, tenantId, cashierId);

      // Assert - Payment created
      expect(result.payment).toBeDefined();
      expect(Number(result.payment.amount)).toBe(10000);
      expect(result.payment.paymentMethod).toBe('CASH');
      expect(result.payment.status).toBe('COMPLETED');
      expect(result.payment.paymentNumber).toMatch(/^PAY-\d{8}-\d{4}$/);

      // Assert - Invoice updated
      expect(result.invoice.paidAmount).toBe(10000);
      expect(result.invoice.balance).toBe(0);
      expect(result.invoice.paymentStatus).toBe('PAID');
      expect(result.invoice.status).toBe('PAID');
      expect(result.invoice.paymentDate).toBeDefined();

      // Verify in database
      const dbInvoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true },
      });

      expect(Number(dbInvoice?.paidAmount)).toBe(10000);
      expect(Number(dbInvoice?.balance)).toBe(0);
      expect(dbInvoice?.paymentStatus).toBe('PAID');
      expect(dbInvoice?.payments).toHaveLength(1);
      expect(Number(dbInvoice?.payments[0].amount)).toBe(10000);
    });
  });

  describe('Partial Payment Flow', () => {
    let partialInvoiceId: string;

    beforeAll(async () => {
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        {
          id: '2',
          description: 'Lab Tests',
          quantity: 3,
          unitPrice: 5000,
          amount: 15000,
        },
      ]);
      partialInvoiceId = invoice.id;
    });

    it('should process first partial payment and update status to PARTIALLY_PAID', async () => {
      // Arrange - First payment of 5000
      const payment1: RecordPaymentDto = {
        invoiceId: partialInvoiceId,
        amount: 5000,
        paymentMethod: 'CASH',
        cashReceivedByName: 'Bisi Adeyemi',
      };

      // Act
      const result1 = await useCase.execute(payment1, tenantId, cashierId);

      // Assert
      expect(result1.invoice.paidAmount).toBe(5000);
      expect(result1.invoice.balance).toBe(10000);
      expect(result1.invoice.paymentStatus).toBe('PARTIALLY_PAID');
      expect(result1.invoice.status).toBe('PARTIALLY_PAID');

      // Verify in database
      const dbInvoice1 = await prisma.invoice.findUnique({
        where: { id: partialInvoiceId },
      });
      expect(Number(dbInvoice1?.paidAmount)).toBe(5000);
      expect(Number(dbInvoice1?.balance)).toBe(10000);
    });

    it('should process second partial payment and update status to PARTIALLY_PAID', async () => {
      // Arrange - Second payment of 5000
      const payment2: RecordPaymentDto = {
        invoiceId: partialInvoiceId,
        amount: 5000,
        paymentMethod: 'CARD',
        cardLast4: '4242',
        cardBrand: 'Visa',
      };

      // Act
      const result2 = await useCase.execute(payment2, tenantId, cashierId);

      // Assert
      expect(result2.invoice.paidAmount).toBe(10000);
      expect(result2.invoice.balance).toBe(5000);
      expect(result2.invoice.paymentStatus).toBe('PARTIALLY_PAID');
      expect(result2.invoice.status).toBe('PARTIALLY_PAID');

      // Verify database has 2 payments
      const dbInvoice2 = await prisma.invoice.findUnique({
        where: { id: partialInvoiceId },
        include: { payments: true },
      });
      expect(dbInvoice2?.payments).toHaveLength(2);
      expect(Number(dbInvoice2?.paidAmount)).toBe(10000);
    });

    it('should process final payment and update status to PAID', async () => {
      // Arrange - Final payment of 5000
      const payment3: RecordPaymentDto = {
        invoiceId: partialInvoiceId,
        amount: 5000,
        paymentMethod: 'MOBILE_MONEY',
        mobileProvider: 'MTN',
        mobileNumber: '+2348012345678',
      };

      // Act
      const result3 = await useCase.execute(payment3, tenantId, cashierId);

      // Assert
      expect(result3.invoice.paidAmount).toBe(15000);
      expect(result3.invoice.balance).toBe(0);
      expect(result3.invoice.paymentStatus).toBe('PAID');
      expect(result3.invoice.status).toBe('PAID');
      expect(result3.invoice.paymentDate).toBeDefined();

      // Verify database
      const dbInvoice3 = await prisma.invoice.findUnique({
        where: { id: partialInvoiceId },
        include: { payments: true },
      });
      expect(dbInvoice3?.payments).toHaveLength(3);
      expect(Number(dbInvoice3?.balance)).toBe(0);
    });
  });

  describe('Transaction Atomicity', () => {
    let atomicTestInvoiceId: string;

    beforeAll(async () => {
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        {
          id: '3',
          description: 'Procedure',
          quantity: 1,
          unitPrice: 20000,
          amount: 20000,
        },
      ]);
      atomicTestInvoiceId = invoice.id;
    });

    it('should rollback payment if transaction fails', async () => {
      // Arrange - Payment that exceeds balance (should fail validation)
      const invalidPayment: RecordPaymentDto = {
        invoiceId: atomicTestInvoiceId,
        amount: 25000, // More than invoice total
        paymentMethod: 'CASH',
      };

      // Act & Assert
      await expect(
        useCase.execute(invalidPayment, tenantId, cashierId)
      ).rejects.toThrow('exceeds invoice balance');

      // Verify no payment was created and invoice unchanged
      const dbInvoice = await prisma.invoice.findUnique({
        where: { id: atomicTestInvoiceId },
        include: { payments: true },
      });

      expect(Number(dbInvoice?.paidAmount)).toBe(0);
      expect(Number(dbInvoice?.balance)).toBe(20000);
      expect(dbInvoice?.paymentStatus).toBe('UNPAID');
      expect(dbInvoice?.payments).toHaveLength(0);
    });
  });

  describe('Payment Methods', () => {
    it('should handle CARD payment with card details', async () => {
      // Arrange
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { id: '4', description: 'Test', quantity: 1, unitPrice: 1000, amount: 1000 },
      ]);

      const cardPayment: RecordPaymentDto = {
        invoiceId: invoice.id,
        amount: 1000,
        paymentMethod: 'CARD',
        cardLast4: '1234',
        cardBrand: 'Mastercard',
        transactionId: 'txn_123456',
      };

      // Act
      const result = await useCase.execute(cardPayment, tenantId, cashierId);

      // Assert
      expect(result.payment.paymentMethod).toBe('CARD');
      expect(result.payment.cardLast4).toBe('1234');
      expect(result.payment.cardBrand).toBe('Mastercard');
      expect(result.payment.transactionId).toBe('txn_123456');
    });

    it('should handle MOBILE_MONEY payment with provider details', async () => {
      // Arrange
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { id: '5', description: 'Test', quantity: 1, unitPrice: 2000, amount: 2000 },
      ]);

      const mobilePayment: RecordPaymentDto = {
        invoiceId: invoice.id,
        amount: 2000,
        paymentMethod: 'MOBILE_MONEY',
        mobileProvider: 'Airtel',
        mobileNumber: '+2348087654321',
        transactionId: 'mob_789012',
      };

      // Act
      const result = await useCase.execute(mobilePayment, tenantId, cashierId);

      // Assert
      expect(result.payment.paymentMethod).toBe('MOBILE_MONEY');
      expect(result.payment.mobileProvider).toBe('Airtel');
      expect(result.payment.mobileNumber).toBe('+2348087654321');
      expect(result.payment.transactionId).toBe('mob_789012');
    });

    it('should handle BANK_TRANSFER payment with reference', async () => {
      // Arrange
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { id: '6', description: 'Test', quantity: 1, unitPrice: 3000, amount: 3000 },
      ]);

      const bankPayment: RecordPaymentDto = {
        invoiceId: invoice.id,
        amount: 3000,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'REF123456',
        transactionId: 'bank_345678',
      };

      // Act
      const result = await useCase.execute(bankPayment, tenantId, cashierId);

      // Assert
      expect(result.payment.paymentMethod).toBe('BANK_TRANSFER');
      expect(result.payment.referenceNumber).toBe('REF123456');
      expect(result.payment.transactionId).toBe('bank_345678');
    });
  });

  describe('Payment Number Generation', () => {
    it('should generate unique payment numbers with date prefix', async () => {
      // Arrange
      const invoice = await createTestInvoice(prisma, tenantId, patientId, cashierId, [
        { id: '7', description: 'Test', quantity: 1, unitPrice: 1000, amount: 1000 },
      ]);

      const payment: RecordPaymentDto = {
        invoiceId: invoice.id,
        amount: 1000,
        paymentMethod: 'CASH',
        cashReceivedByName: 'Bisi Adeyemi',
      };

      // Act
      const result = await useCase.execute(payment, tenantId, cashierId);

      // Assert
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const expectedPrefix = `PAY-${year}${month}${day}`;

      expect(result.payment.paymentNumber).toMatch(new RegExp(`^${expectedPrefix}-\\d{4}$`));
    });
  });
});
