/**
 * Billing Validators
 *
 * Joi validation schemas for the billing module — previously had none at
 * all (billing.routes.ts had no validateRequest anywhere). Most of the
 * dangerous cases (negative amounts, NaN, over-balance payments/refunds)
 * are already caught with clean, specific error messages inside the
 * use-cases themselves — these schemas are deliberately loose on bounds
 * already enforced there (e.g. payment `amount`) so that friendlier
 * business-rule message still surfaces instead of a generic Joi one, and
 * mainly close the remaining shape/enum gaps at the HTTP boundary.
 */

import Joi from 'joi';

const SERVICE_CATEGORIES = ['CONSULTATION', 'LAB_TEST', 'MEDICATION', 'PROCEDURE', 'IMAGING', 'ACCOMMODATION', 'OTHER'];
const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'INSURANCE'];
const GATEWAY_PROVIDERS = ['FLUTTERWAVE', 'PAYSTACK', 'MONIEPOINT'];

// ── Service Catalog ──────────────────────────────────────────────────────────

export const addServiceSchema = Joi.object<any>({
  serviceCode: Joi.string().trim().min(1).max(50).required(),
  serviceName: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  category: Joi.string().valid(...SERVICE_CATEGORIES).required(),
  basePrice: Joi.number().min(0).required(),
  taxRate: Joi.number().min(0).max(100).optional(),
  isActive: Joi.boolean().optional(),
});

export const updateServiceSchema = Joi.object<any>({
  serviceName: Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  category: Joi.string().valid(...SERVICE_CATEGORIES).optional(),
  basePrice: Joi.number().min(0).optional(),
  taxRate: Joi.number().min(0).max(100).optional(),
  isActive: Joi.boolean().optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

// ── Invoices ──────────────────────────────────────────────────────────────────

const manualLineItemSchema = Joi.object<any>({
  description: Joi.string().trim().max(300).allow('', null).optional(),
  serviceName: Joi.string().trim().max(300).allow('', null).optional(),
  quantity: Joi.number().optional(),
  unitPrice: Joi.number().optional(),
  discount: Joi.number().optional(),
  tax: Joi.number().optional(),
  taxAmount: Joi.number().optional(),
});

export const createInvoiceSchema = Joi.object<any>({
  patientId: Joi.string().required(),
  lineItems: Joi.array().items(manualLineItemSchema).min(1).required(),
  discount: Joi.number().min(0).optional(),
  notes: Joi.string().trim().max(2000).allow('', null).optional(),
  dueDate: Joi.date().iso().allow('', null).optional(),
});

const additionalItemSchema = Joi.object<any>({
  serviceName: Joi.string().trim().min(1).max(300).required(),
  quantity: Joi.number().positive().required(),
  unitPrice: Joi.number().min(0).required(),
  taxRate: Joi.number().min(0).max(100).optional(),
});

export const generateInvoiceSchema = Joi.object<any>({
  patientId: Joi.string().required(),
  consultationIds: Joi.array().items(Joi.string()).optional(),
  labTestIds: Joi.array().items(Joi.string()).optional(),
  prescriptionIds: Joi.array().items(Joi.string()).optional(),
  admissionIds: Joi.array().items(Joi.string()).optional(),
  consumableUsageIds: Joi.array().items(Joi.string()).optional(),
  transfusionChartIds: Joi.array().items(Joi.string()).optional(),
  operationNoteIds: Joi.array().items(Joi.string()).optional(),
  laborRecordIds: Joi.array().items(Joi.string()).optional(),
  postnatalVisitIds: Joi.array().items(Joi.string()).optional(),
  additionalItems: Joi.array().items(additionalItemSchema).optional(),
  discount: Joi.number().min(0).optional(),
  notes: Joi.string().trim().max(2000).allow('', null).optional(),
});

export const updateInvoiceSchema = Joi.object<any>({
  discount: Joi.number().min(0).optional(),
  notes: Joi.string().trim().max(2000).allow('', null).optional(),
  dueDate: Joi.date().iso().allow('', null).optional(),
  version: Joi.number().integer().min(0).optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

export const cancelInvoiceSchema = Joi.object<any>({
  reason: Joi.string().trim().max(500).allow('', null).optional(),
});

// ── Payments ──────────────────────────────────────────────────────────────────

export const recordPaymentSchema = Joi.object<any>({
  invoiceId: Joi.string().required(),
  amount: Joi.number().required(),
  paymentMethod: Joi.string().valid(...PAYMENT_METHODS).required(),
  paymentDate: Joi.date().iso().optional(),
  referenceNumber: Joi.string().trim().max(200).allow('', null).optional(),
  transactionId: Joi.string().trim().max(200).allow('', null).optional(),
  cardLast4: Joi.string().trim().max(4).allow('', null).optional(),
  cardBrand: Joi.string().trim().max(50).allow('', null).optional(),
  mobileProvider: Joi.string().trim().max(50).allow('', null).optional(),
  mobileNumber: Joi.string().trim().max(50).allow('', null).optional(),
  notes: Joi.string().trim().max(2000).allow('', null).optional(),
  cashReceivedByName: Joi.string().trim().max(200).allow('', null).optional(),
  receiptPhotoUrl: Joi.string().trim().max(1000).allow('', null).optional(),
  proofDocumentUrl: Joi.string().trim().max(1000).allow('', null).optional(),
  approverName: Joi.string().trim().max(200).allow('', null).optional(),
  deviceId: Joi.string().trim().max(200).allow('', null).optional(),
});

// ── Refunds ───────────────────────────────────────────────────────────────────

export const requestRefundSchema = Joi.object<any>({
  invoiceId: Joi.string().required(),
  paymentId: Joi.string().allow('', null).optional(),
  amount: Joi.number().required(),
  reason: Joi.string().trim().min(1).max(1000).required(),
  refundMethod: Joi.string().valid(...PAYMENT_METHODS).required(),
  notes: Joi.string().trim().max(2000).allow('', null).optional(),
});

export const rejectRefundSchema = Joi.object<any>({
  rejectionReason: Joi.string().trim().min(1).max(1000).required(),
});

export const processRefundSchema = Joi.object<any>({
  referenceNumber: Joi.string().trim().max(200).allow('', null).optional(),
});

// ── Gateway Payments ──────────────────────────────────────────────────────────

export const initiateGatewayPaymentSchema = Joi.object<any>({
  invoiceId: Joi.string().required(),
  amount: Joi.number().required(),
  gateway: Joi.string().valid(...GATEWAY_PROVIDERS).required(),
  customerEmail: Joi.string().trim().email({ tlds: false }).allow('', null).optional(),
  customerName: Joi.string().trim().max(200).allow('', null).optional(),
  customerPhone: Joi.string().trim().max(50).allow('', null).optional(),
  callbackUrl: Joi.string().trim().max(1000).allow('', null).optional(),
  redirectUrl: Joi.string().trim().max(1000).allow('', null).optional(),
});

export const verifyGatewayPaymentSchema = Joi.object<any>({
  paymentReference: Joi.string().required(),
});
