/**
 * Billing Controller
 *
 * Handle all billing and payment related requests
 */

import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { logger } from '../../config/logger';

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

// Refund Use Cases
import { RequestRefundUseCase } from '../../application/use-cases/billing/request-refund.use-case';
import { ApproveRefundUseCase } from '../../application/use-cases/billing/approve-refund.use-case';
import { RejectRefundUseCase } from '../../application/use-cases/billing/reject-refund.use-case';
import { ProcessRefundUseCase } from '../../application/use-cases/billing/process-refund.use-case';
import { GetRefundRequestsUseCase } from '../../application/use-cases/billing/get-refund-requests.use-case';

// Gateway Payment Use Cases
import { InitiateGatewayPaymentUseCase } from '../../application/use-cases/billing/initiate-gateway-payment.use-case';
import { VerifyGatewayPaymentUseCase } from '../../application/use-cases/billing/verify-gateway-payment.use-case';

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
      error: error.message
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
      error: error.message
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
      error: error.message
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
      error: error.message
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

    const {
      patientId,
      lineItems,
      subtotal,
      tax,
      discount,
      totalAmount,
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

    // Generate unique invoice number
    const invoiceCount = await prisma.invoice.count({ where: { tenantId } });
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, '0')}`;

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        patientId,
        tenantId,
        issuedById: userId,
        subtotal: subtotal || 0,
        taxAmount: tax || 0,
        discount: discount || 0,
        totalAmount: totalAmount || 0,
        paidAmount: 0,
        balance: totalAmount || 0,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        lineItems: JSON.stringify(lineItems),
        notes: notes || undefined,
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
      error: error.message
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
      message: error.message || 'Failed to generate invoice',
      error: error.message
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
      error: error.message
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

    return res.status(200).json({
      success: true,
      message: 'Invoice details retrieved successfully',
      data: invoice
    });
  } catch (error: any) {
    logger.error('Error fetching invoice details:', error);

    if (error.message === 'Invoice not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice details',
      error: error.message
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

    const invoice = await updateInvoiceUseCase.execute(id, updateData, tenantId);

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

    return res.status(500).json({
      success: false,
      message: 'Failed to update invoice',
      error: error.message
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

    const invoice = await cancelInvoiceUseCase.execute(id, tenantId, reason);

    return res.status(200).json({
      success: true,
      message: 'Invoice cancelled successfully',
      data: invoice
    });
  } catch (error: any) {
    logger.error('Error cancelling invoice:', error);

    if (error.message.includes('Cannot cancel') || error.message === 'Invoice not found') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to cancel invoice',
      error: error.message
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
      message: error.message || 'Failed to record payment',
      error: error.message
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
      error: error.message
    });
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
      error: error.message
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
      error: error.message
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
      message: error.message || 'Failed to request refund',
      error: error.message
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
      error: error.message
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
      error: error.message
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
      error: error.message
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
      error: error.message
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
    if (!tenantId) {
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

    const result = await initiateGatewayPaymentUseCase.execute(paymentData, tenantId);

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
      error: error.message
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
      error: error.message
    });
  }
};
