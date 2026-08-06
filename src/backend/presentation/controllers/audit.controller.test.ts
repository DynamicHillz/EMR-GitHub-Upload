/**
 * Audit Controller Tests
 *
 * getInvoiceAuditTrail / getPaymentAuditTrail: surface InvoiceAuditLog/
 * PaymentAuditLog — previously written to but never read by any endpoint —
 * as an on-demand drill-down for the Audit Log UI's Details modal. Covers
 * tenant scoping and chronological ordering.
 *
 * getAuditLogs (search): the search box only ever matched raw ids (userId/
 * entityId), never the resolved names the UI actually displays — searching
 * "Jane" to find what Jane did, or a patient's name to find their record's
 * trail, silently matched nothing. Fixed to also match the performing
 * user's name (a real Prisma relation), a resolved patient/user entity
 * name (a best-effort secondary lookup, since entityId has no fixed
 * relation), and metadata (where failed-login attempts store the
 * attempted email/reason).
 */

const mockPrismaInstance = {
  invoiceAuditLog: { findMany: jest.fn() },
  paymentAuditLog: { findMany: jest.fn() },
  auditLog: { findMany: jest.fn(), count: jest.fn() },
  patient: { findMany: jest.fn().mockResolvedValue([]) },
  user: { findMany: jest.fn().mockResolvedValue([]) },
  invoice: { findMany: jest.fn().mockResolvedValue([]) },
  payment: { findMany: jest.fn().mockResolvedValue([]) },
  refund: { findMany: jest.fn().mockResolvedValue([]) },
  appointment: { findMany: jest.fn().mockResolvedValue([]) },
  consultation: { findMany: jest.fn().mockResolvedValue([]) },
  prescription: { findMany: jest.fn().mockResolvedValue([]) },
  medication: { findMany: jest.fn().mockResolvedValue([]) },
  ward: { findMany: jest.fn().mockResolvedValue([]) },
  insuranceProvider: { findMany: jest.fn().mockResolvedValue([]) },
  insuranceClaim: { findMany: jest.fn().mockResolvedValue([]) },
  patientInsurance: { findMany: jest.fn().mockResolvedValue([]) },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaInstance),
}));

import { AuditController } from './audit.controller';

describe('AuditController', () => {
  let controller: AuditController;

  const tenantId = 'tenant-1';

  const mockReq = (params: any) => ({ params, user: { tenantId } } as any);
  const mockGetLogsReq = (query: any) => ({ params: {}, query, user: { tenantId } } as any);
  const mockRes = () => {
    const res: any = {};
    res.json = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuditController();
  });

  describe('getInvoiceAuditTrail', () => {
    it('queries InvoiceAuditLog scoped by tenantId and invoiceId, ordered chronologically', async () => {
      mockPrismaInstance.invoiceAuditLog.findMany.mockResolvedValue([
        { id: 'log-1', invoiceId: 'invoice-1', action: 'CREATED', createdAt: new Date('2026-06-01') },
      ]);

      const res = mockRes();
      await controller.getInvoiceAuditTrail(mockReq({ invoiceId: 'invoice-1' }), res);

      expect(mockPrismaInstance.invoiceAuditLog.findMany).toHaveBeenCalledWith({
        where: { tenantId, invoiceId: 'invoice-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: 'log-1', invoiceId: 'invoice-1', action: 'CREATED', createdAt: new Date('2026-06-01') }],
      });
    });

    it('returns an empty array rather than an error when the invoice has no audit trail', async () => {
      mockPrismaInstance.invoiceAuditLog.findMany.mockResolvedValue([]);

      const res = mockRes();
      await controller.getInvoiceAuditTrail(mockReq({ invoiceId: 'invoice-2' }), res);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
    });

    it('returns a 500 rather than throwing when the query fails', async () => {
      mockPrismaInstance.invoiceAuditLog.findMany.mockRejectedValue(new Error('db down'));

      const res = mockRes();
      await controller.getInvoiceAuditTrail(mockReq({ invoiceId: 'invoice-3' }), res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPaymentAuditTrail', () => {
    it('queries PaymentAuditLog scoped by tenantId and paymentId, ordered chronologically', async () => {
      mockPrismaInstance.paymentAuditLog.findMany.mockResolvedValue([
        { id: 'log-1', paymentId: 'payment-1', action: 'FLAGGED', createdAt: new Date('2026-06-01') },
      ]);

      const res = mockRes();
      await controller.getPaymentAuditTrail(mockReq({ paymentId: 'payment-1' }), res);

      expect(mockPrismaInstance.paymentAuditLog.findMany).toHaveBeenCalledWith({
        where: { tenantId, paymentId: 'payment-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: 'log-1', paymentId: 'payment-1', action: 'FLAGGED', createdAt: new Date('2026-06-01') }],
      });
    });

    it('scopes strictly by tenantId — a payment from another tenant is not returned', async () => {
      // The mock itself doesn't enforce isolation; this asserts the query the
      // controller sends is tenant-scoped, which is what actually enforces it.
      mockPrismaInstance.paymentAuditLog.findMany.mockResolvedValue([]);

      await controller.getPaymentAuditTrail(mockReq({ paymentId: 'payment-other-tenant' }), mockRes());

      const callArgs = mockPrismaInstance.paymentAuditLog.findMany.mock.calls[0][0];
      expect(callArgs.where.tenantId).toBe(tenantId);
    });
  });

  describe('getAuditLogs search', () => {
    beforeEach(() => {
      mockPrismaInstance.auditLog.findMany.mockResolvedValue([]);
      mockPrismaInstance.auditLog.count.mockResolvedValue(0);
      mockPrismaInstance.patient.findMany.mockResolvedValue([]);
      mockPrismaInstance.user.findMany.mockResolvedValue([]);
    });

    it('matches the performing user by name via the real user relation', async () => {
      await controller.getAuditLogs(mockGetLogsReq({ search: 'Jane' }), mockRes());

      const where = mockPrismaInstance.auditLog.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual(
        expect.arrayContaining([
          {
            user: {
              OR: [
                { firstName: { contains: 'Jane', mode: 'insensitive' } },
                { lastName: { contains: 'Jane', mode: 'insensitive' } },
              ],
            },
          },
        ])
      );
    });

    it('matches a full "First Last" name as displayed in the UI, not just a single word', async () => {
      // Regression: plain firstName-contains-X OR lastName-contains-X can
      // never match a two-word string like "Deborah Williams" — neither
      // column individually contains the space-joined full name. Confirmed
      // live against real data: searching "Deborah" alone matched 10 rows,
      // searching "Deborah Williams" (the name exactly as shown in the
      // table) matched 0.
      await controller.getAuditLogs(mockGetLogsReq({ search: 'Deborah Williams' }), mockRes());

      const where = mockPrismaInstance.auditLog.findMany.mock.calls[0][0].where;
      const userClause = where.OR.find((c: any) => c.user)?.user;
      expect(userClause.OR).toEqual(
        expect.arrayContaining([
          {
            AND: [
              { firstName: { contains: 'Deborah', mode: 'insensitive' } },
              { lastName: { contains: 'Williams', mode: 'insensitive' } },
            ],
          },
        ])
      );
    });

    it('matches metadata content, e.g. a failed login\'s attempted email', async () => {
      await controller.getAuditLogs(mockGetLogsReq({ search: 'nobody@test.com' }), mockRes());

      const where = mockPrismaInstance.auditLog.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual(
        expect.arrayContaining([{ metadata: { contains: 'nobody@test.com', mode: 'insensitive' } }])
      );
    });

    it('resolves a matching patient name to their id and includes it in the entityId match', async () => {
      mockPrismaInstance.patient.findMany.mockResolvedValue([{ id: 'patient-1' }, { id: 'patient-2' }]);

      await controller.getAuditLogs(mockGetLogsReq({ search: 'Amaka' }), mockRes());

      expect(mockPrismaInstance.patient.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          OR: [
            { firstName: { contains: 'Amaka', mode: 'insensitive' } },
            { lastName: { contains: 'Amaka', mode: 'insensitive' } },
            { patientId: { contains: 'Amaka', mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      const where = mockPrismaInstance.auditLog.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual(
        expect.arrayContaining([{ entityId: { in: ['patient-1', 'patient-2'] } }])
      );
    });

    it('omits the resolved-entityId clause entirely when no patient or user name matches', async () => {
      await controller.getAuditLogs(mockGetLogsReq({ search: 'nonexistent-name' }), mockRes());

      const where = mockPrismaInstance.auditLog.findMany.mock.calls[0][0].where;
      expect(where.OR.some((clause: any) => 'entityId' in clause && clause.entityId?.in)).toBe(false);
    });

    it('still matches raw userId/action/entityId/entityType substrings as before', async () => {
      await controller.getAuditLogs(mockGetLogsReq({ search: 'PATIENT_CREATED' }), mockRes());

      const where = mockPrismaInstance.auditLog.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual(
        expect.arrayContaining([
          { userId: { contains: 'PATIENT_CREATED', mode: 'insensitive' } },
          { action: { contains: 'PATIENT_CREATED', mode: 'insensitive' } },
          { entityId: { contains: 'PATIENT_CREATED', mode: 'insensitive' } },
          { entityType: { contains: 'PATIENT_CREATED', mode: 'insensitive' } },
        ])
      );
    });

    it('does not run the name-resolution queries at all when no search term is given', async () => {
      await controller.getAuditLogs(mockGetLogsReq({}), mockRes());

      expect(mockPrismaInstance.patient.findMany).not.toHaveBeenCalled();
      expect(mockPrismaInstance.user.findMany).not.toHaveBeenCalled();
      const where = mockPrismaInstance.auditLog.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeUndefined();
    });

    it('reports a null entityName (not the string "Unknown ID") for a genuine list-view row with no entityId', async () => {
      // A null entityId is overwhelmingly a real list/aggregate GET (e.g.
      // GET /api/billing/invoices) — not evidence of a bug. The old
      // "Unknown ID" placeholder read as if something were broken.
      mockPrismaInstance.auditLog.findMany.mockResolvedValue([
        { id: 'log-1', entityType: 'BILLING', entityId: null, action: 'BILLING_VIEWED', userId: 'user-1', user: null },
      ]);

      const res = mockRes();
      await controller.getAuditLogs(mockGetLogsReq({}), res);

      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.logs[0].entityName).toBeNull();
    });
  });

  describe('getAuditLogs entity name resolution', () => {
    beforeEach(() => {
      mockPrismaInstance.auditLog.count.mockResolvedValue(1);
      mockPrismaInstance.patient.findMany.mockResolvedValue([]);
      mockPrismaInstance.user.findMany.mockResolvedValue([]);
    });

    it('resolves a PAYMENT entityId to "Payment <number> — <patient name>" instead of the raw UUID', async () => {
      mockPrismaInstance.auditLog.findMany.mockResolvedValue([
        { id: 'log-1', entityType: 'PAYMENT', entityId: 'payment-1', action: 'PAYMENT_VIEWED', userId: 'user-1', user: null },
      ]);
      mockPrismaInstance.payment.findMany.mockResolvedValue([
        { id: 'payment-1', paymentNumber: 'PAY-20260801-0001', patient: { firstName: 'Hillary', lastName: 'Amalokwu' } },
      ]);

      const res = mockRes();
      await controller.getAuditLogs(mockGetLogsReq({}), res);

      expect(mockPrismaInstance.payment.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['payment-1'] }, tenantId },
        select: { id: true, paymentNumber: true, patient: { select: { firstName: true, lastName: true } } },
      });
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.logs[0].entityName).toBe('Payment PAY-20260801-0001 — Hillary Amalokwu');
    });

    it('resolves an INVOICE entityId to "Invoice <number> — <patient name>"', async () => {
      mockPrismaInstance.auditLog.findMany.mockResolvedValue([
        { id: 'log-1', entityType: 'INVOICE', entityId: 'invoice-1', action: 'INVOICE_VIEWED', userId: 'user-1', user: null },
      ]);
      mockPrismaInstance.invoice.findMany.mockResolvedValue([
        { id: 'invoice-1', invoiceNumber: 'INV-20260801-0001', patient: { firstName: 'Jane', lastName: 'Doe' } },
      ]);

      const res = mockRes();
      await controller.getAuditLogs(mockGetLogsReq({}), res);

      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.logs[0].entityName).toBe('Invoice INV-20260801-0001 — Jane Doe');
    });

    it('falls back to the raw entityId when it has a resolver but the record no longer resolves (e.g. deleted)', async () => {
      mockPrismaInstance.auditLog.findMany.mockResolvedValue([
        { id: 'log-1', entityType: 'PAYMENT', entityId: 'payment-deleted', action: 'PAYMENT_VIEWED', userId: 'user-1', user: null },
      ]);
      mockPrismaInstance.payment.findMany.mockResolvedValue([]); // no longer exists

      const res = mockRes();
      await controller.getAuditLogs(mockGetLogsReq({}), res);

      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.logs[0].entityName).toBe('payment-deleted');
    });

    it('does not route a PATIENT_INSURANCE id into the Patient resolver via substring match', async () => {
      // Regression: the old code used entityType.includes('PATIENT'), which
      // 'PATIENT_INSURANCE'.includes('PATIENT') also satisfies — resolving
      // the map by exact entityType key avoids that cross-wiring.
      mockPrismaInstance.auditLog.findMany.mockResolvedValue([
        { id: 'log-1', entityType: 'PATIENT_INSURANCE', entityId: 'policy-1', action: 'PATIENT_INSURANCE_CREATED', userId: 'user-1', user: null },
      ]);
      mockPrismaInstance.patientInsurance.findMany.mockResolvedValue([
        { id: 'policy-1', policyNumber: 'POL-001', patient: { firstName: 'Amaka', lastName: 'Eze' } },
      ]);

      const res = mockRes();
      await controller.getAuditLogs(mockGetLogsReq({}), res);

      expect(mockPrismaInstance.patient.findMany).not.toHaveBeenCalled();
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.logs[0].entityName).toBe('Policy POL-001 — Amaka Eze');
    });

    it('batches ids of the same type into a single query rather than one query per row', async () => {
      mockPrismaInstance.auditLog.findMany.mockResolvedValue([
        { id: 'log-1', entityType: 'MEDICATION', entityId: 'med-1', action: 'MEDICATION_VIEWED', userId: 'user-1', user: null },
        { id: 'log-2', entityType: 'MEDICATION', entityId: 'med-2', action: 'MEDICATION_VIEWED', userId: 'user-1', user: null },
      ]);
      mockPrismaInstance.medication.findMany.mockResolvedValue([
        { id: 'med-1', name: 'Amoxicillin' },
        { id: 'med-2', name: 'Paracetamol' },
      ]);

      const res = mockRes();
      await controller.getAuditLogs(mockGetLogsReq({}), res);

      expect(mockPrismaInstance.medication.findMany).toHaveBeenCalledTimes(1);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.logs.map((l: any) => l.entityName)).toEqual(['Amoxicillin', 'Paracetamol']);
    });
  });
});
