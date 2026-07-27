/**
 * Billing Module - API Service Layer
 * Handles all API calls to the billing endpoints
 */

import axios, { AxiosInstance } from 'axios';
import { offlineFetch } from './offlineFetch';
import {
  ApiResponse,
  ServiceCatalog,
  CreateServiceDto,
  UpdateServiceDto,
  ServiceCatalogFilters,
  Invoice,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceFilters,
  Payment,
  RecordPaymentDto,
  InitiateGatewayPaymentDto,
  GatewayPaymentResponse,
  VerifyPaymentDto,
  PaymentFilters,
  Refund,
  RequestRefundDto,
  ApproveRefundDto,
  RejectRefundDto,
  RefundFilters,
  OutstandingInvoice,
  PatientBalance,
  AgingAnalysis,
} from '../types/billing.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`;

class BillingService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/billing`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle response errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Redirect to login or refresh token
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // ==================== SERVICE CATALOG ====================

  async getServices(filters?: ServiceCatalogFilters): Promise<ServiceCatalog[]> {
    const { data } = await this.api.get<ApiResponse<ServiceCatalog[]>>('/services', {
      params: filters,
    });
    return data.data || [];
  }

  async getServiceById(id: string): Promise<ServiceCatalog> {
    const { data } = await this.api.get<ApiResponse<ServiceCatalog>>(`/services/${id}`);
    if (!data.data) throw new Error('Service not found');
    return data.data;
  }

  async createService(serviceData: CreateServiceDto): Promise<ServiceCatalog> {
    const { data } = await this.api.post<ApiResponse<ServiceCatalog>>('/services', serviceData);
    if (!data.data) throw new Error('Failed to create service');
    return data.data;
  }

  async updateService(id: string, serviceData: UpdateServiceDto): Promise<ServiceCatalog> {
    const { data } = await this.api.patch<ApiResponse<ServiceCatalog>>(`/services/${id}`, serviceData);
    if (!data.data) throw new Error('Failed to update service');
    return data.data;
  }

  async deleteService(id: string): Promise<void> {
    await this.api.delete(`/services/${id}`);
  }

  // ==================== INVOICES ====================

  async getInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
    const { data } = await this.api.get<ApiResponse<any>>('/invoices', {
      params: filters,
    });
    const invoices = data.data?.invoices || data.data;
    return Array.isArray(invoices) ? invoices : [];
  }

  async getInvoiceById(id: string): Promise<Invoice> {
    const { data } = await this.api.get<ApiResponse<Invoice>>(`/invoices/${id}`);
    if (!data.data) throw new Error('Invoice not found');
    return data.data;
  }

  async createInvoice(invoiceData: CreateInvoiceDto): Promise<Invoice> {
    const { data } = await this.api.post<ApiResponse<Invoice>>('/invoices', invoiceData);
    if (!data.data) throw new Error('Failed to create invoice');
    return data.data;
  }

  async generateInvoice(invoiceData: {
    patientId: string;
    prescriptionIds?: string[];
    labTestIds?: string[];
    consultationIds?: string[];
    admissionIds?: string[];
    consumableUsageIds?: string[];
    transfusionChartIds?: string[];
    operationNoteIds?: string[];
    laborRecordIds?: string[];
    additionalItems?: {
      serviceName: string;
      quantity: number;
      unitPrice: number;
      taxRate?: number;
    }[];
    discount?: number;
    notes?: string;
  }): Promise<Invoice> {
    const { data } = await this.api.post<ApiResponse<Invoice>>('/invoices/generate', invoiceData);
    if (!data.data) throw new Error('Failed to generate invoice');
    return data.data;
  }

  // Routed through offlineFetch (rather than the axios instance every other
  // method here uses) so an edit made while offline queues for replay
  // instead of just failing outright — the backend's sync-push endpoint has
  // supported INVOICE updates for a while, but nothing in the UI actually
  // used the offline path to reach it.
  async updateInvoice(id: string, invoiceData: UpdateInvoiceDto): Promise<{ invoice: Invoice | null; queued: boolean }> {
    const token = localStorage.getItem('token');
    const response = await offlineFetch(
      `${API_BASE_URL}/billing/invoices/${id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(invoiceData),
      },
      { entityType: 'INVOICE', entityId: id, baseVersion: invoiceData.version }
    );
    const data = await response.json();

    if (data.queued) {
      // No fresh server-authoritative invoice is available yet — the caller
      // should treat this as "saved offline", not a normal completed edit.
      return { invoice: null, queued: true };
    }
    if (response.status === 409) {
      throw new Error(data.message || 'This invoice was changed elsewhere. Please reload and try again.');
    }
    if (!data.data) throw new Error(data.message || 'Failed to update invoice');
    return { invoice: data.data, queued: false };
  }

  async cancelInvoice(id: string): Promise<Invoice> {
    const { data } = await this.api.post<ApiResponse<Invoice>>(`/invoices/${id}/cancel`);
    if (!data.data) throw new Error('Failed to cancel invoice');
    return data.data;
  }

  // ==================== PAYMENTS ====================

  async getPayments(filters?: PaymentFilters): Promise<Payment[]> {
    const { data } = await this.api.get<ApiResponse<any>>('/payments', {
      params: filters,
    });
    return data.data?.payments || [];
  }

  async getPaymentById(id: string): Promise<Payment> {
    const { data } = await this.api.get<ApiResponse<Payment>>(`/payments/${id}`);
    if (!data.data) throw new Error('Payment not found');
    return data.data;
  }

  async getInvoicePayments(invoiceId: string): Promise<Payment[]> {
    const { data } = await this.api.get<ApiResponse<Payment[]>>(`/invoices/${invoiceId}/payments`);
    return data.data || [];
  }

  async recordPayment(paymentData: RecordPaymentDto): Promise<Payment> {
    const { data } = await this.api.post<ApiResponse<Payment>>('/payments', paymentData);
    if (!data.data) throw new Error('Failed to record payment');
    return data.data;
  }

  async getFraudPreventionSettings(): Promise<{
    requireReceiptPhotoForCash: boolean;
    requireReferenceForBankTransfer: boolean;
    requireReferenceForMobileMoney: boolean;
    cashApprovalThreshold: number;
    bankTransferApprovalThreshold: number;
    mobileMoneyApprovalThreshold: number;
  }> {
    const { data } = await this.api.get<ApiResponse<any>>('/fraud-prevention-settings');
    return data.data;
  }

  async getPaymentReceipt(paymentId: string): Promise<any> {
    const { data } = await this.api.get<ApiResponse<any>>(`/payments/${paymentId}/receipt`);
    return data.data;
  }

  async markReceiptPrinted(paymentId: string): Promise<void> {
    await this.api.patch(`/payments/${paymentId}/receipt/printed`);
  }

  async emailPaymentReceipt(paymentId: string): Promise<void> {
    await this.api.post(`/payments/${paymentId}/receipt/email`);
  }

  // ==================== GATEWAY PAYMENTS ====================

  async initiateGatewayPayment(paymentData: InitiateGatewayPaymentDto): Promise<GatewayPaymentResponse> {
    const { data } = await this.api.post<ApiResponse<GatewayPaymentResponse>>(
      '/gateway-payments/initiate',
      paymentData
    );
    if (!data.data) throw new Error('Failed to initiate payment');
    return data.data;
  }

  async verifyGatewayPayment(verifyData: VerifyPaymentDto): Promise<{ payment: Payment; invoice: Invoice }> {
    const { data } = await this.api.post<ApiResponse<{ payment: Payment; invoice: Invoice }>>(
      '/gateway-payments/verify',
      verifyData
    );
    if (!data.data) throw new Error('Failed to verify payment');
    return data.data;
  }

  // ==================== OUTSTANDING BALANCES ====================

  async getOutstandingInvoices(): Promise<any[]> {
    const { data } = await this.api.get<ApiResponse<any>>('/outstanding');
    // Backend returns { invoices: [], summary: { totalOutstanding, totalInvoices, aging } }
    return data.data?.invoices || [];
  }

  async getPatientBalance(patientId: string): Promise<PatientBalance> {
    const { data } = await this.api.get<ApiResponse<PatientBalance>>(`/outstanding/${patientId}`);
    if (!data.data) throw new Error('Patient balance not found');
    return data.data;
  }

  async getUnbilledQueue(): Promise<{ patients: any[]; totalPatients: number; totalItems: number }> {
    const { data } = await this.api.get<ApiResponse<any>>('/unbilled');
    return data.data || { patients: [], totalPatients: 0, totalItems: 0 };
  }

  async getAgingAnalysis(): Promise<AgingAnalysis> {
    const { data } = await this.api.get<ApiResponse<any>>('/outstanding');
    // Backend returns { invoices: [], summary: { totalOutstanding, totalInvoices, aging } }
    const summary = data.data?.summary;
    if (!summary) throw new Error('Aging analysis not found');

    // Transform backend aging format to frontend format
    const aging = summary.aging;
    return {
      buckets: [
        {
          period: 'Current',
          totalAmount: aging.current || 0,
          invoiceCount: data.data?.invoices.filter((inv: any) => inv.daysOverdue === 0).length || 0
        },
        {
          period: '1-30 Days',
          totalAmount: aging.days1_30 || 0,
          invoiceCount: data.data?.invoices.filter((inv: any) => inv.daysOverdue >= 1 && inv.daysOverdue <= 30).length || 0
        },
        {
          period: '31-60 Days',
          totalAmount: aging.days31_60 || 0,
          invoiceCount: data.data?.invoices.filter((inv: any) => inv.daysOverdue >= 31 && inv.daysOverdue <= 60).length || 0
        },
        {
          period: '61-90 Days',
          totalAmount: aging.days61_90 || 0,
          invoiceCount: data.data?.invoices.filter((inv: any) => inv.daysOverdue >= 61 && inv.daysOverdue <= 90).length || 0
        },
        {
          period: '90+ Days',
          totalAmount: aging.days90Plus || 0,
          invoiceCount: data.data?.invoices.filter((inv: any) => inv.daysOverdue > 90).length || 0
        }
      ],
      totalOutstanding: summary.totalOutstanding || 0
    };
  }

  // ==================== REFUNDS ====================

  async getRefunds(filters?: RefundFilters): Promise<Refund[]> {
    const { data } = await this.api.get<ApiResponse<any>>('/refunds', {
      params: filters,
    });
    return data.data?.refunds || [];
  }

  async getRefundById(id: string): Promise<Refund> {
    const { data } = await this.api.get<ApiResponse<Refund>>(`/refunds/${id}`);
    if (!data.data) throw new Error('Refund not found');
    return data.data;
  }

  async requestRefund(refundData: RequestRefundDto): Promise<Refund> {
    const { data } = await this.api.post<ApiResponse<Refund>>('/refunds', refundData);
    if (!data.data) throw new Error('Failed to request refund');
    return data.data;
  }

  async approveRefund(id: string, approvalData: ApproveRefundDto): Promise<Refund> {
    const { data } = await this.api.post<ApiResponse<Refund>>(`/refunds/${id}/approve`, approvalData);
    if (!data.data) throw new Error('Failed to approve refund');
    return data.data;
  }

  async rejectRefund(id: string, rejectionData: RejectRefundDto): Promise<Refund> {
    const { data } = await this.api.post<ApiResponse<Refund>>(`/refunds/${id}/reject`, rejectionData);
    if (!data.data) throw new Error('Failed to reject refund');
    return data.data;
  }

  async processRefund(id: string, processData?: { referenceNumber?: string }): Promise<Refund> {
    const { data } = await this.api.post<ApiResponse<Refund>>(`/refunds/${id}/process`, processData || {});
    if (!data.data) throw new Error('Failed to process refund');
    return data.data;
  }
}

export const billingService = new BillingService();
export default billingService;
