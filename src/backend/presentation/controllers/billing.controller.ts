/**
 * Billing Controller
 *
 * Handle all billing and payment related requests
 */

import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { logger } from '../../config/logger';
import { verificationService } from '../../application/services/verification.service';
import { EmailService } from '../../infrastructure/services/email.service';

// Service Catalog Use Cases
import { GetServiceCatalogUseCase } from '../../application/use-cases/billing/get-service-catalog.use-case';
import { AddServiceUseCase } from '../../application/use-cases/billing/add-service.use-case';
import { UpdateServiceUseCase } from '../../application/use-cases/billing/update-service.use-case';
import { DeleteServiceUseCase } from '../../application/use-cases/billing/delete-service.use-case';

// Invoice Use Cases
import { GenerateInvoiceUseCase } from '../../application/use-cases/billing/generate-invoice.use-case';
import { GetInvoicesUseCase } from '../../application/use-cases/billing/get-invoices.use-case';
import { GetInvoiceDetailsUseCase } from '../../application/use-cases/billing/get-invoice-details.use-case';
import { UpdateInvoiceUseCase } from '../../application/use-cases/billing/update-invoice.use-case';
import { CancelInvoiceUseCase } from '../../application/use-cases/billing/cancel-invoice.use-case';

// Payment Use Cases
import { RecordPaymentUseCase } from '../../application/use-cases/billing/record-payment.use-case';
import { GetPaymentHistoryUseCase } from '../../application/use-cases/billing/get-payment-history.use-case';

// Outstanding Balance Use Cases
import { GetOutstandingInvoicesUseCase } from '../../application/use-cases/billing/get-outstanding-invoices.use-case';
import { GetPatientBalanceUseCase } from '../../application/use-cases/billing/get-patient-balance.use-case';
import { GetUnbilledQueueUseCase } from '../../application/use-cases/billing/get-unbilled-queue.use-case';

// Refund Use Cases
import { RequestRefundUseCase } from '../../application/use-cases/billing/request-refund.use-case';
import { ApproveRefundUseCase } from '../../application/use-cases/billing/approve-refund.use-case';
import { RejectRefundUseCase } from '../../application/use-cases/billing/reject-refund.use-case';
import { ProcessRefundUseCase } from '../../application/use-cases/billing/process-refund.use-case';
import { GetRefundRequestsUseCase } from '../../application/use-cases/billing/get-refund-requests.use-case';

// Gateway Payment Use Cases
import { InitiateGatewayPaymentUseCase } from '../../application/use-cases/billing/initiate-gateway-payment.use-case';
import { VerifyGatewayPaymentUseCase } from '../../application/use-cases/billing/verify-gateway-payment.use-case';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

// ==================== SERVICE CATALOG ====================

const getServiceCatalogUseCase = new GetServiceCatalogUseCase(prisma);
const addServiceUseCase = new AddServiceUseCase(prisma);
const updateServiceUseCase = new UpdateServiceUseCase(prisma);
const deleteServiceUseCase = new DeleteServiceUseCase(prisma);

// ==================== INVOICES ====================

const generateInvoiceUseCase = new GenerateInvoiceUseCase(prisma);
const getInvoicesUseCase = new GetInvoicesUseCase(prisma);
const getInvoiceDetailsUseCase = new GetInvoiceDetailsUseCase(prisma);
const updateInvoiceUseCase = new UpdateInvoiceUseCase(prisma);
const cancelInvoiceUseCase = new CancelInvoiceUseCase(prisma);

// ==================== PAYMENTS ====================

const recordPaymentUseCase = new RecordPaymentUseCase(prisma);
const getPaymentHistoryUseCase = new GetPaymentHistoryUseCase(prisma);

// ==================== OUTSTANDING BALANCES ====================

const getOutstandingInvoicesUseCase = new GetOutstandingInvoicesUseCase(prisma);
const getPatientBalanceUseCase = new GetPatientBalanceUseCase(prisma);
const getUnbilledQueueUseCase = new GetUnbilledQueueUseCase(prisma);

// ==================== REFUNDS ====================

const requestRefundUseCase = new RequestRefundUseCase(prisma);
const approveRefundUseCase = new ApproveRefundUseCase(prisma);
const rejectRefundUseCase = new RejectRefundUseCase(prisma);
const processRefundUseCase = new ProcessRefundUseCase(prisma);
const getRefundRequestsUseCase = new GetRefundRequestsUseCase(prisma);

// ==================== GATEWAY PAYMENTS ====================

const initiateGatewayPaymentUseCase = new InitiateGatewayPaymentUseCase(prisma);
const verifyGatewayPaymentUseCase = new VerifyGatewayPaymentUseCase(prisma);

/**
 * GET /api/billing/services
 * Get service catalog (REQ-BILL-6)
 */
export const getServices = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found'
      });
    }

    const { category, activeOnly } = req.query;

    let services;
    if (category) {
      services = await getServiceCatalogUseCase.getByCategory(
        tenantId,
        category as any
      );
    } else {
      services = await getServiceCatalogUseCase.execute(
        tenantId,
        activeOnly !== 'false'
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Services retrieved successfully',
      data: services
    });
  } catch (error: any) {
    logger.error('Error fetching services:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
    });
  }
};

/**
 * POST /api/billing/services
 * Add new service to catalog (REQ-BILL-6)
 */
export const addService = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found'
      });
    }

    const serviceData = {
      serviceCode: req.body.serviceCode,
      serviceName: req.body.serviceName,
      description: req.body.description,
      category: req.body.category,
      basePrice: parseFloat(req.body.basePrice),
      taxRate: req.body.taxRate ? parseFloat(req.body.taxRate) : undefined,
      isActive: req.body.isActive
    };

    const service = await addServiceUseCase.execute(serviceData, tenantId);

    return res.status(201).json({
      success: true,
      message: 'Service added successfully',
      data: service
    });
  } catch (error: any) {
    logger.error('Error adding service:', error);

    if (error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to add service',
    });
  }
};

/**
 * PUT /api/billing/services/:id
 * Update service (REQ-BILL-6)
 */
export const updateService = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found'
      });
    }

    const { id } = req.params;

    const updateData: any = {};
    if (req.body.serviceName) updateData.serviceName = req.body.serviceName;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.category) updateData.category = req.body.category;
    if (req.body.basePrice !== undefined) updateData.basePrice = parseFloat(req.body.basePrice);
    if (req.body.taxRate !== undefined) updateData.taxRate = parseFloat(req.body.taxRate);
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

    const service = await updateServiceUseCase.execute(id, updateData, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      data: service
    });
  } catch (error: any) {
    logger.error('Error updating service:', error);

    if (error.message === 'Service not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update service',
    });
  }
};

/**
 * DELETE /api/billing/services/:id
 * Delete (deactivate) service (REQ-BILL-6)
 */
export const deleteService = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found'
      });
    }

    const { id } = req.params;

    const service = await deleteServiceUseCase.execute(id, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Service deactivated successfully',
      data: service
    });
  } catch (error: any) {
    logger.error('Error deleting service:', error);

    if (error.message === 'Service not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to delete service',
    });
  }
};

// ==================== INVOICE MANAGEMENT ====================

/**
 * POST /api/billing/invoices
 * Create manual invoice with line items
 */
export const createInvoice = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // subtotal/tax/totalAmount are deliberately NOT read from req.body here —
    // see the server-side recomputation below.
    const {
      patientId,
      lineItems,
      discount,
      notes,
      dueDate
    } = req.body;

    // Validate required fields
    if (!patientId || !lineItems || lineItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID and line items are required'
      });
    }

    // Verify the patient actually belongs to this tenant before linking an
    // invoice to it — without this, a valid staff JWT from one tenant could
    // reference a patient record belonging to a different tenant entirely.
    const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId } });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Generate unique invoice number
    const invoiceCount = await prisma.invoice.count({ where: { tenantId } });
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, '0')}`;

    // Server-side recomputation — this manual-entry path (unlike
    // generate-invoice.use-case.ts's auto-pulled billable items) never had
    // any authoritative price to check line items against, so subtotal/tax/
    // totalAmount and every line item's own subtotal were previously taken
    // straight from req.body and trusted verbatim. Never write the client's
    // aggregate figures directly — always derive them from sanitized line
    // items, so a modified request (or a buggy client build) can't bill a
    // patient less than what's actually itemized, or submit negative prices.
    const sanitizedLineItems = (lineItems || []).map((item: any) => {
      const quantity = Math.max(1, Math.trunc(Number(item.quantity)) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const itemDiscount = Math.max(0, Number(item.discount) || 0);
      const itemTax = Math.max(0, Number(item.tax ?? item.taxAmount) || 0);
      const lineSubtotal = Math.max(0, quantity * unitPrice - itemDiscount + itemTax);
      return {
        serviceCode: 'CUSTOM',
        description: item.description || item.serviceName || 'Custom Item',
        quantity,
        unitPrice,
        discount: itemDiscount,
        tax: itemTax,
        subtotal: lineSubtotal,
        insuranceCoverage: 0,
        patientOutOfPocket: lineSubtotal,
      };
    });

    const computedSubtotal = sanitizedLineItems.reduce((sum: number, i: typeof sanitizedLineItems[number]) => sum + (i.quantity * i.unitPrice - i.discount), 0);
    const computedTax = sanitizedLineItems.reduce((sum: number, i: typeof sanitizedLineItems[number]) => sum + i.tax, 0);
    const invoiceDiscount = Math.max(0, Number(discount) || 0);
    const computedTotal = Math.max(0, computedSubtotal + computedTax - invoiceDiscount);

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        patientId,
        tenantId,
        issuedById: userId,
        subtotal: computedSubtotal,
        taxAmount: computedTax,
        discount: invoiceDiscount,
        totalAmount: computedTotal,
        paidAmount: 0,
        balance: computedTotal,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        notes: notes || undefined,
        items: {
          create: sanitizedLineItems as any
        }
      },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            phone: true,
          }
        },
        issuedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice
    });
  } catch (error: any) {
    logger.error('Error creating invoice:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create invoice',
    });
  }
};

/**
 * POST /api/billing/invoices/generate
 * Generate invoice from services (REQ-BILL-1)
 */
export const generateInvoice = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const invoiceData = {
      patientId: req.body.patientId,
      consultationIds: req.body.consultationIds,
      labTestIds: req.body.labTestIds,
      prescriptionIds: req.body.prescriptionIds,
      admissionIds: req.body.admissionIds,
      consumableUsageIds: req.body.consumableUsageIds,
      additionalItems: req.body.additionalItems,
      discount: req.body.discount,
      notes: req.body.notes
    };

    const invoice = await generateInvoiceUseCase.execute(invoiceData, tenantId, userId);

    return res.status(201).json({
      success: true,
      message: 'Invoice generated successfully',
      data: invoice
    });
  } catch (error: any) {
    logger.error('Error generating invoice:', error);
    return res.status(500).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to generate invoice'),
    });
  }
};

/**
 * GET /api/billing/invoices
 * Get invoices with filters (REQ-BILL-1)
 */
export const getInvoices = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const filters: any = {
      patientId: req.query.patientId as string,
      status: req.query.status as any,
      paymentStatus: req.query.paymentStatus as any,
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string);
    }

    const result = await getInvoicesUseCase.execute(tenantId, filters);

    return res.status(200).json({
      success: true,
      message: 'Invoices retrieved successfully',
      data: result.invoices,
      total: result.total,
      limit: result.limit,
      offset: result.offset
    });
  } catch (error: any) {
    logger.error('Error fetching invoices:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
    });
  }
};

/**
 * GET /api/billing/invoices/:id
 * Get invoice details (REQ-BILL-1)
 */
export const getInvoiceDetails = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { id } = req.params;
    const invoice = await getInvoiceDetailsUseCase.execute(id, tenantId);

    // Generate secure verification token for QR code
    const verificationToken = verificationService.generateVerificationToken({
      type: 'INVOICE',
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount,
    });

    return res.status(200).json({
      success: true,
      message: 'Invoice details retrieved successfully',
      data: {
        ...invoice,
        verificationToken,
      }
    });
  } catch (error: any) {
    logger.error('Error fetching invoice details:', error);

    if (error.name === 'NotFoundError' || error.message === 'Invoice not found') {
      return res.status(404).json({
        success: false,
        message: 'The requested invoice could not be found or has been deleted.'
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: 'Failed to fetch invoice details',
    });
  }
};

/**
 * PUT /api/billing/invoices/:id
 * Update invoice (REQ-BILL-1)
 */
export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { id } = req.params;
    const updateData: any = {};

    if (req.body.discount !== undefined) updateData.discount = parseFloat(req.body.discount);
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    if (req.body.dueDate) updateData.dueDate = new Date(req.body.dueDate);
    if (req.body.version !== undefined) updateData.version = req.body.version;

    const userId = (req.user as any)?.id;
    const invoice = await updateInvoiceUseCase.execute(id, updateData, tenantId, userId);

    return res.status(200).json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoice
    });
  } catch (error: any) {
    logger.error('Error updating invoice:', error);

    if (error.message === 'Invoice not found' || error.message.includes('Cannot update')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to update invoice',
    });
  }
};

/**
 * DELETE /api/billing/invoices/:id
 * Cancel invoice (REQ-BILL-1)
 */
export const cancelInvoice = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;

    const invoice = await cancelInvoiceUseCase.execute(id, tenantId, userId, reason);

    return res.status(200).json({
      success: true,
      message: 'Invoice cancelled successfully',
      data: invoice
    });
  } catch (error: any) {
    logger.error('Error cancelling invoice:', error);

    if (error.name === 'NotFoundError' || error.message === 'Invoice not found') {
      return res.status(404).json({
        success: false,
        message: 'The requested invoice could not be found.'
      });
    }

    if (error.message.includes('Cannot cancel')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: 'Failed to cancel invoice',
    });
  }
};

// ==================== PAYMENT PROCESSING ====================

/**
 * POST /api/billing/payments
 * Record payment (REQ-BILL-2, REQ-BILL-3)
 */
export const recordPayment = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const paymentData = {
      invoiceId: req.body.invoiceId,
      amount: parseFloat(req.body.amount),
      paymentMethod: req.body.paymentMethod,
      paymentDate: req.body.paymentDate ? new Date(req.body.paymentDate) : undefined,
      referenceNumber: req.body.referenceNumber,
      transactionId: req.body.transactionId,
      cardLast4: req.body.cardLast4,
      cardBrand: req.body.cardBrand,
      mobileProvider: req.body.mobileProvider,
      mobileNumber: req.body.mobileNumber,
      notes: req.body.notes,
      // Fraud prevention fields
      receiptPhotoUrl: req.body.receiptPhotoUrl,
      proofDocumentUrl: req.body.proofDocumentUrl,
    };

    // Capture fraud prevention context from request
    const fraudContext = {
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      deviceId: req.body.deviceId || req.headers['x-device-id'] as string,
    };

    const result = await recordPaymentUseCase.execute(paymentData, tenantId, userId, fraudContext);

    // Return success with fraud prevention info
    return res.status(201).json({
      success: true,
      message: result.fraudPrevention?.requiresApproval
        ? 'Payment recorded and pending supervisor approval'
        : result.fraudPrevention?.flaggedForReview
        ? 'Payment recorded but flagged for review'
        : 'Payment recorded successfully',
      data: result,
      warnings: result.fraudPrevention?.flaggedForReview
        ? [`Payment flagged: ${result.fraudPrevention.flagReason}`]
        : undefined,
    });
  } catch (error: any) {
    logger.error('Error recording payment:', error);
    return res.status(500).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to record payment'),
    });
  }
};

/**
 * GET /api/billing/payments
 * Get payment history (REQ-BILL-3)
 */
export const getPaymentHistory = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const filters: any = {
      invoiceId: req.query.invoiceId as string,
      patientId: req.query.patientId as string,
      paymentMethod: req.query.paymentMethod as any,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string);
    }

    const result = await getPaymentHistoryUseCase.execute(tenantId, filters);

    return res.status(200).json({
      success: true,
      message: 'Payment history retrieved successfully',
      data: result.payments,
      total: result.total,
      limit: result.limit,
      offset: result.offset
    });
  } catch (error: any) {
    logger.error('Error fetching payment history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
    });
  }
};

/**
 * GET /api/billing/fraud-prevention-settings
 * Read-only subset of tenant fraud-prevention settings the frontend needs
 * (e.g. whether a receipt photo is still required for cash payments now
 * that the system generates real receipts).
 */
export const getFraudPreventionSettingsForPaymentForm = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const settings = await prisma.fraudPreventionSettings.findUnique({
      where: { tenantId },
      select: {
        requireReceiptPhotoForCash: true,
        requireReferenceForBankTransfer: true,
        requireReferenceForMobileMoney: true,
        cashApprovalThreshold: true,
        bankTransferApprovalThreshold: true,
        mobileMoneyApprovalThreshold: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: settings || {
        requireReceiptPhotoForCash: true,
        requireReferenceForBankTransfer: true,
        requireReferenceForMobileMoney: true,
        cashApprovalThreshold: 50000,
        bankTransferApprovalThreshold: 100000,
        mobileMoneyApprovalThreshold: 75000,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching fraud prevention settings:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
};

// ==================== RECEIPTS ====================

/**
 * GET /api/billing/payments/:id/receipt
 * Everything a receipt needs in one call: payment, invoice + line items,
 * patient, who processed it, and the tenant's letterhead branding.
 */
export const getPaymentReceipt = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;

    const payment = await prisma.payment.findFirst({
      where: { id, tenantId },
      include: {
        invoice: { include: { items: true } },
        patient: { select: { id: true, firstName: true, lastName: true, patientId: true, phone: true, email: true } },
        processedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { clinicName: true, address: true, phone: true, email: true, logoUrl: true, invoiceFooterText: true },
    });

    return res.status(200).json({ success: true, data: { payment, branding: tenant } });
  } catch (error: any) {
    logger.error('Error fetching payment receipt:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch receipt' });
  }
};

/**
 * PATCH /api/billing/payments/:id/receipt/printed
 * Marks the receipt as printed — the print page calls this on mount,
 * mirroring the auto-print-on-load pattern used by the lab report page.
 */
export const markReceiptPrinted = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const payment = await prisma.payment.findFirst({ where: { id, tenantId } });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    await prisma.payment.update({ where: { id }, data: { receiptPrinted: true } });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error('Error marking receipt as printed:', error);
    return res.status(500).json({ success: false, message: 'Failed to update receipt status' });
  }
};

/**
 * POST /api/billing/payments/:id/receipt/email
 * Emails the receipt to the patient's address on file. EmailService is a
 * stub in this environment (logs only) — this endpoint is fully wired and
 * will start actually delivering the moment EmailService is made real.
 */
export const emailPaymentReceipt = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const payment = await prisma.payment.findFirst({
      where: { id, tenantId },
      include: {
        invoice: { include: { items: true } },
        patient: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (!payment.patient?.email) {
      return res.status(400).json({ success: false, message: 'Patient has no email address on file' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { clinicName: true, address: true, phone: true, email: true, logoUrl: true, invoiceFooterText: true },
    });

    await EmailService.sendReceiptEmail(payment.patient.email, { payment, branding: tenant });

    return res.status(200).json({ success: true, message: 'Receipt emailed' });
  } catch (error: any) {
    logger.error('Error emailing payment receipt:', error);
    return res.status(500).json({ success: false, message: 'Failed to email receipt' });
  }
};

// ==================== OUTSTANDING BALANCES ====================

/**
 * GET /api/billing/outstanding
 * Get outstanding invoices (REQ-BILL-4)
 */
export const getOutstandingInvoices = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const result = await getOutstandingInvoicesUseCase.execute(tenantId);

    return res.status(200).json({
      success: true,
      message: 'Outstanding invoices retrieved successfully',
      data: result
    });
  } catch (error: any) {
    logger.error('Error fetching outstanding invoices:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch outstanding invoices',
    });
  }
};

/**
 * GET /api/billing/unbilled
 * Clinic-wide unbilled queue, grouped by patient — dispensed prescriptions,
 * lab orders, and finalized consultations not yet on an invoice.
 */
export const getUnbilledQueue = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const result = await getUnbilledQueueUseCase.execute(tenantId);

    return res.status(200).json({
      success: true,
      message: 'Unbilled queue retrieved successfully',
      data: result
    });
  } catch (error: any) {
    logger.error('Error fetching unbilled queue:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch unbilled queue',
    });
  }
};

/**
 * GET /api/billing/outstanding/:patientId
 * Get patient balance (REQ-BILL-4)
 */
export const getPatientBalance = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { patientId } = req.params;
    const result = await getPatientBalanceUseCase.execute(patientId, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Patient balance retrieved successfully',
      data: result
    });
  } catch (error: any) {
    logger.error('Error fetching patient balance:', error);

    if (error.message === 'Patient not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch patient balance',
    });
  }
};

// ==================== REFUNDS ====================

/**
 * POST /api/billing/refunds
 * Request refund (REQ-BILL-5)
 */
export const requestRefund = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const refundData = {
      invoiceId: req.body.invoiceId,
      paymentId: req.body.paymentId,
      amount: parseFloat(req.body.amount),
      reason: req.body.reason,
      refundMethod: req.body.refundMethod,
      notes: req.body.notes
    };

    const refund = await requestRefundUseCase.execute(refundData, tenantId, userId);

    return res.status(201).json({
      success: true,
      message: 'Refund request created successfully',
      data: refund
    });
  } catch (error: any) {
    logger.error('Error requesting refund:', error);
    return res.status(500).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to request refund'),
    });
  }
};

/**
 * POST /api/billing/refunds/:id/approve
 * Approve refund (REQ-BILL-5)
 */
export const approveRefund = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { id } = req.params;
    const refund = await approveRefundUseCase.execute(id, tenantId, userId);

    return res.status(200).json({
      success: true,
      message: 'Refund approved successfully',
      data: refund
    });
  } catch (error: any) {
    logger.error('Error approving refund:', error);

    if (error.message === 'Refund request not found' || error.message.includes('Cannot approve')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to approve refund',
    });
  }
};

/**
 * POST /api/billing/refunds/:id/reject
 * Reject refund (REQ-BILL-5)
 */
export const rejectRefund = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const refund = await rejectRefundUseCase.execute(id, rejectionReason, tenantId, userId);

    return res.status(200).json({
      success: true,
      message: 'Refund rejected successfully',
      data: refund
    });
  } catch (error: any) {
    logger.error('Error rejecting refund:', error);

    if (error.message === 'Refund request not found' || error.message.includes('Cannot reject')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to reject refund',
    });
  }
};

/**
 * POST /api/billing/refunds/:id/process
 * Process refund (REQ-BILL-5)
 */
export const processRefund = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { id } = req.params;
    const processData = {
      referenceNumber: req.body.referenceNumber
    };

    const result = await processRefundUseCase.execute(id, processData, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: result
    });
  } catch (error: any) {
    logger.error('Error processing refund:', error);

    if (error.message === 'Refund request not found' || error.message.includes('must be approved')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to process refund',
    });
  }
};

/**
 * GET /api/billing/refunds
 * Get refund requests (REQ-BILL-5)
 */
export const getRefundRequests = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const filters: any = {
      status: req.query.status as any,
      invoiceId: req.query.invoiceId as string,
      patientId: req.query.patientId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    const result = await getRefundRequestsUseCase.execute(tenantId, filters);

    return res.status(200).json({
      success: true,
      message: 'Refund requests retrieved successfully',
      data: result.refunds,
      total: result.total,
      limit: result.limit,
      offset: result.offset
    });
  } catch (error: any) {
    logger.error('Error fetching refund requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch refund requests',
    });
  }
};

// ==================== GATEWAY PAYMENTS (REQ-BILL-7) ====================

/**
 * POST /api/billing/gateway-payments/initiate
 * Initiate payment via payment gateway (Flutterwave, Paystack, Moniepoint, etc.)
 */
export const initiateGatewayPayment = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const paymentData = {
      invoiceId: req.body.invoiceId,
      amount: parseFloat(req.body.amount),
      gateway: req.body.gateway, // FLUTTERWAVE, PAYSTACK, MONIEPOINT
      customerEmail: req.body.customerEmail,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone,
      callbackUrl: req.body.callbackUrl,
      redirectUrl: req.body.redirectUrl
    };

    const result = await initiateGatewayPaymentUseCase.execute(paymentData, tenantId, userId);

    return res.status(201).json({
      success: true,
      message: 'Payment initiated successfully',
      data: result
    });
  } catch (error: any) {
    logger.error('Error initiating gateway payment:', error);

    if (error.message.includes('Invoice not found') ||
        error.message.includes('exceeds invoice balance') ||
        error.message.includes('cancelled invoice')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
    });
  }
};

/**
 * POST /api/billing/gateway-payments/verify
 * Verify payment via payment gateway
 */
export const verifyGatewayPayment = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { paymentReference } = req.body;

    if (!paymentReference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    const result = await verifyGatewayPaymentUseCase.execute(paymentReference, tenantId);

    if (result.alreadyProcessed) {
      return res.status(200).json({
        success: true,
        message: 'Payment already processed',
        data: result
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: result
    });
  } catch (error: any) {
    logger.error('Error verifying gateway payment:', error);

    if (error.message.includes('Payment not found') ||
        error.message.includes('verification failed')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
    });
  }
};
