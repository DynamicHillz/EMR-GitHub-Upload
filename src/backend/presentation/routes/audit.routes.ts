import { Router } from 'express';
import { auditController } from '../controllers/audit.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/permission.middleware';

const router = Router();

// Protect all audit routes to ensure only authenticated users can access them
router.use(authenticate);

// Ensure ONLY Super Admins can access the audit log and system archive
router.use(requireRole('SUPER_ADMIN'));

// Action Audit Logs
router.get('/logs', auditController.getAuditLogs.bind(auditController));

// Domain-specific audit trails — drill-down detail for a single invoice/payment,
// surfaced from the Audit Log UI's Details modal (see AuditDashboardPage.tsx).
router.get('/invoice-logs/:invoiceId', auditController.getInvoiceAuditTrail.bind(auditController));
router.get('/payment-logs/:paymentId', auditController.getPaymentAuditTrail.bind(auditController));

// System Archive (Soft Deleted Records)
router.get('/archive/:entityType', auditController.getArchivedRecords.bind(auditController));
router.post('/archive/:entityType/:id/restore', auditController.restoreRecord.bind(auditController));

export default router;
