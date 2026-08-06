/**
 * Billing Routes
 * Role-based access control applied per permission matrix
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  addServiceSchema,
  updateServiceSchema,
  createInvoiceSchema,
  generateInvoiceSchema,
  updateInvoiceSchema,
  cancelInvoiceSchema,
  recordPaymentSchema,
  requestRefundSchema,
  rejectRefundSchema,
  processRefundSchema,
  initiateGatewayPaymentSchema,
  verifyGatewayPaymentSchema,
} from '../../application/validators/billing.validator';
import {
  getServices,
  addService,
  updateService,
  deleteService,
  createInvoice,
  generateInvoice,
  getInvoices,
  getInvoiceDetails,
  updateInvoice,
  cancelInvoice,
  recordPayment,
  getPaymentHistory,
  getOutstandingInvoices,
  getPatientBalance,
  getUnbilledQueue,
  requestRefund,
  approveRefund,
  rejectRefund,
  processRefund,
  getRefundRequests,
  initiateGatewayPayment,
  verifyGatewayPayment,
  getPaymentReceipt,
  markReceiptPrinted,
  emailPaymentReceipt,
  getFraudPreventionSettingsForPaymentForm,
} from '../controllers/billing.controller';

const router = Router();

// View billing: ADMIN, DOCTOR, CASHIER, LAB_TECH, NURSE
const CAN_VIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECH', 'CASHIER']);

// Create invoices & record payments: ADMIN, CASHIER
const CAN_BILL = requireRole(['SUPER_ADMIN', 'ADMIN', 'CASHIER']);

// Manage service catalog: ADMIN only
const ADMIN_ONLY = requireRole(['SUPER_ADMIN', 'ADMIN']);

// Refund approval: ADMIN only
const CAN_APPROVE_REFUND = requireRole(['SUPER_ADMIN', 'ADMIN']);

// ── Service Catalog ───────────────────────────────────────────────────────────
router.get('/services', CAN_VIEW, asyncHandler(getServices));
router.post('/services', ADMIN_ONLY, validateRequest(addServiceSchema, 'body'), asyncHandler(addService));
router.put('/services/:id', ADMIN_ONLY, validateRequest(updateServiceSchema, 'body'), asyncHandler(updateService));
router.delete('/services/:id', ADMIN_ONLY, asyncHandler(deleteService));

// ── Invoices ──────────────────────────────────────────────────────────────────
router.get('/invoices', CAN_VIEW, asyncHandler(getInvoices));
router.get('/invoices/:id', CAN_VIEW, asyncHandler(getInvoiceDetails));
router.post('/invoices/generate', CAN_BILL, validateRequest(generateInvoiceSchema, 'body'), asyncHandler(generateInvoice));
router.post('/invoices', CAN_BILL, validateRequest(createInvoiceSchema, 'body'), asyncHandler(createInvoice));
router.put('/invoices/:id', CAN_BILL, validateRequest(updateInvoiceSchema, 'body'), asyncHandler(updateInvoice));
router.delete('/invoices/:id', CAN_BILL, validateRequest(cancelInvoiceSchema, 'body'), asyncHandler(cancelInvoice));
router.post('/invoices/:id/cancel', CAN_BILL, validateRequest(cancelInvoiceSchema, 'body'), asyncHandler(cancelInvoice));

// ── Payments ──────────────────────────────────────────────────────────────────
router.get('/fraud-prevention-settings', CAN_VIEW, asyncHandler(getFraudPreventionSettingsForPaymentForm));
router.get('/payments', CAN_VIEW, asyncHandler(getPaymentHistory));
router.post('/payments', CAN_BILL, validateRequest(recordPaymentSchema, 'body'), asyncHandler(recordPayment));
router.get('/payments/:id/receipt', CAN_VIEW, asyncHandler(getPaymentReceipt));
router.patch('/payments/:id/receipt/printed', CAN_VIEW, asyncHandler(markReceiptPrinted));
router.post('/payments/:id/receipt/email', CAN_BILL, asyncHandler(emailPaymentReceipt));

// ── Outstanding Balances ──────────────────────────────────────────────────────
router.get('/outstanding', CAN_VIEW, asyncHandler(getOutstandingInvoices));
router.get('/unbilled', CAN_VIEW, asyncHandler(getUnbilledQueue));
router.get('/outstanding/:patientId', CAN_VIEW, asyncHandler(getPatientBalance));

// ── Refunds ───────────────────────────────────────────────────────────────────
router.get('/refunds', CAN_VIEW, asyncHandler(getRefundRequests));
router.post('/refunds', CAN_BILL, validateRequest(requestRefundSchema, 'body'), asyncHandler(requestRefund));
router.post('/refunds/:id/approve', CAN_APPROVE_REFUND, asyncHandler(approveRefund));
router.post('/refunds/:id/reject', CAN_APPROVE_REFUND, validateRequest(rejectRefundSchema, 'body'), asyncHandler(rejectRefund));
router.post('/refunds/:id/process', CAN_APPROVE_REFUND, validateRequest(processRefundSchema, 'body'), asyncHandler(processRefund));

// ── Gateway Payments ──────────────────────────────────────────────────────────
router.post('/gateway-payments/initiate', CAN_BILL, validateRequest(initiateGatewayPaymentSchema, 'body'), asyncHandler(initiateGatewayPayment));
router.post('/gateway-payments/verify', CAN_BILL, validateRequest(verifyGatewayPaymentSchema, 'body'), asyncHandler(verifyGatewayPayment));

export default router;