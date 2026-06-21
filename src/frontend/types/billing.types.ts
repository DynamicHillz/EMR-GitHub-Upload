/**
 * Billing Module - TypeScript Types and Interfaces
 * Matches backend Prisma schema and API responses
 */

// ============================================
// ENUMS
// ============================================

export enum ServiceCategory {
  CONSULTATION = 'CONSULTATION',
  LAB_TEST = 'LAB_TEST',
  MEDICATION = 'MEDICATION',
  PROCEDURE = 'PROCEDURE',
  IMAGING = 'IMAGING',
  OTHER = 'OTHER',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  CANCELLED = 'CANCELLED',
  OVERDUE = 'OVERDUE',
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  MOBILE_MONEY = 'MOBILE_MONEY',
  INSURANCE = 'INSURANCE',
}

export enum PaymentProcessStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum RefundStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentGateway {
  FLUTTERWAVE = 'FLUTTERWAVE',
  PAYSTACK = 'PAYSTACK',
  MONIEPOINT = 'MONIEPOINT',
  STRIPE = 'STRIPE',
  INTERSWITCH = 'INTERSWITCH',
  REMITA = 'REMITA',
  PAYPAL = 'PAYPAL',
  SQUARE = 'SQUARE',
  RAZORPAY = 'RAZORPAY',
}

// ============================================
// SERVICE CATALOG
// ============================================

export interface ServiceCatalog {
  id: string;
  tenantId: string;
  serviceCode: string;
  serviceName: string;
  description?: string;
  category: ServiceCategory;
  basePrice: number;
  taxRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceDto {
  serviceCode: string;
  serviceName: string;
  description?: string;
  category: ServiceCategory;
  basePrice: number;
  taxRate?: number;
  isActive?: boolean;
}

export interface UpdateServiceDto {
  serviceName?: string;
  description?: string;
  category?: ServiceCategory;
  basePrice?: number;
  taxRate?: number;
  isActive?: boolean;
}

// ============================================
// INVOICE
// ============================================

export interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  total: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  patientId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lineItems?: InvoiceLineItem[];
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
  };
}

export interface CreateInvoiceDto {
  patientId: string;
  invoiceDate?: string;
  dueDate?: string;
  subtotal: number;
  tax?: number;
  discount?: number;
  totalAmount: number;
  notes?: string;
  lineItems: InvoiceLineItem[];
}

export interface UpdateInvoiceDto {
  status?: InvoiceStatus;
  dueDate?: string;
  discount?: number;
  notes?: string;
}

// ============================================
// PAYMENT
// ============================================

export interface Payment {
  id: string;
  tenantId: string;
  invoiceId: string;
  patientId: string;
  processedById: string;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  transactionId?: string;
  cardLast4?: string;
  cardBrand?: string;
  mobileProvider?: string;
  mobileNumber?: string;
  gatewayProvider?: string;
  gatewayRef?: string;
  gatewayData?: any;
  gatewayStatus?: string;
  status: PaymentProcessStatus;
  receiptUrl?: string;
  receiptPrinted: boolean;
  createdAt: string;
  updatedAt: string;
  invoice?: Invoice;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface RecordPaymentDto {
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate?: string;
  referenceNumber?: string;
  transactionId?: string;
  cardLast4?: string;
  cardBrand?: string;
  mobileProvider?: string;
  mobileNumber?: string;

  // Fraud prevention fields
  receiptPhotoUrl?: string;      // Photo of physical receipt (required for cash)
  proofDocumentUrl?: string;     // Additional proof document (bank slip, etc.)
}

export interface InitiateGatewayPaymentDto {
  invoiceId: string;
  amount: number;
  gateway: PaymentGateway;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  callbackUrl?: string;
  redirectUrl?: string;
}

export interface GatewayPaymentResponse {
  payment: Payment;
  paymentUrl: string;
  reference: string;
  gatewayRef: string;
}

export interface VerifyPaymentDto {
  paymentReference: string;
}

// ============================================
// REFUND
// ============================================

export interface Refund {
  id: string;
  tenantId: string;
  invoiceId: string;
  paymentId?: string;
  patientId: string;
  refundNumber: string;
  amount: number;
  reason: string;
  refundMethod: PaymentMethod;
  status: RefundStatus;
  requestedById: string;
  requestedAt: string;
  approvedById?: string;
  approvedAt?: string;
  rejectedById?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  refundDate?: string;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  invoice?: Invoice;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  requestedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface RequestRefundDto {
  invoiceId: string;
  paymentId?: string;
  amount: number;
  reason: string;
  refundMethod: PaymentMethod;
  notes?: string;
}

export interface ApproveRefundDto {
  refundDate?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface RejectRefundDto {
  rejectionReason: string;
}

// ============================================
// OUTSTANDING BALANCES
// ============================================

export interface OutstandingInvoice {
  invoiceId: string;
  invoiceNumber: string;
  tenantId: string;
  patientId: string;
  patientName: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  invoiceDate: string;
  dueDate?: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  daysOverdue?: number;
  agingBucket?: 'current' | '1_30' | '31_60' | '61_90' | '90_plus';
}

export interface PatientBalance {
  patientId: string;
  patientName: string;
  totalOutstanding: number;
  invoiceCount: number;
  oldestInvoiceDate?: string;
  invoices: OutstandingInvoice[];
}

export interface AgingAnalysis {
  current: {
    count: number;
    totalAmount: number;
  };
  days1_30: {
    count: number;
    totalAmount: number;
  };
  days31_60: {
    count: number;
    totalAmount: number;
  };
  days61_90: {
    count: number;
    totalAmount: number;
  };
  days90Plus: {
    count: number;
    totalAmount: number;
  };
  total: {
    count: number;
    totalAmount: number;
  };
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// FILTERS AND QUERY PARAMS
// ============================================

export interface ServiceCatalogFilters {
  category?: ServiceCategory;
  isActive?: boolean;
  search?: string;
}

export interface InvoiceFilters {
  patientId?: string;
  status?: InvoiceStatus;
  paymentStatus?: PaymentStatus;
  startDate?: string;
  endDate?: string;
}

export interface PaymentFilters {
  invoiceId?: string;
  patientId?: string;
  paymentMethod?: PaymentMethod;
  status?: PaymentProcessStatus;
  startDate?: string;
  endDate?: string;
}

export interface RefundFilters {
  status?: RefundStatus;
  patientId?: string;
  startDate?: string;
  endDate?: string;
}

// ============================================
// UI STATE TYPES
// ============================================

export interface BillingState {
  services: ServiceCatalog[];
  invoices: Invoice[];
  payments: Payment[];
  refunds: Refund[];
  outstandingInvoices: OutstandingInvoice[];
  loading: boolean;
  error: string | null;
}

export interface FormState {
  isSubmitting: boolean;
  error: string | null;
  success: boolean;
}
