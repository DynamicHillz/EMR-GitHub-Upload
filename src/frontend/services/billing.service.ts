/**
 * Billing Module - API Service Layer
 * Handles all API calls to the billing endpoints
 */

import axios, { AxiosInstance } from 'axios';
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

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
    const { data } = await this.api.get<ApiResponse<Invoice[]>>('/invoices', {
      params: filters,
    });
    return data.data || [];
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

  async updateInvoice(id: string, invoiceData: UpdateInvoiceDto): Promise<Invoice> {
    const { data } = await this.api.patch<ApiResponse<Invoice>>(`/invoices/${id}`, invoiceData);
    if (!data.data) throw new Error('Failed to update invoice');
    return data.data;
  }

  async cancelInvoice(id: string): Promise<Invoice> {
    const { data } = await this.api.post<ApiResponse<Invoice>>(`/invoices/${id}/cancel`);
    if (!data.data) throw new Error('Failed to cancel invoice');
    return data.data;
  }

  // ==================== PAYMENTS ====================

  async getPayments(filters?: PaymentFilters): Promise<Payment[]> {
    const { data } = await this.api.get<ApiResponse<Payment[]>>('/payments', {
      params: filters,
    });
    return data.data || [];
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
    const { data } = await this.api.get<ApiResponse<Refund[]>>('/refunds', {
      params: filters,
    });
    return data.data || [];
  }

  async getRefundById(id: string): Promise<Refund> {
    const { data } = await this.api.get<ApiResponse<Refund>>(`/refunds/${id}`);
    if (!data.data) throw new Error('Refund not found');
    return data.data;
  }

  async requestRefund(refundData: RequestRefundDto): Promise<Refund> {
    const { data } = await this.api.post<ApiResponse<Refund>>('/refunds/request', refundData);
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

  async processRefund(id: string): Promise<Refund> {
    const { data } = await this.api.post<ApiResponse<Refund>>(`/refunds/${id}/process`);
    if (!data.data) throw new Error('Failed to process refund');
    return data.data;
  }
}

export const billingService = new BillingService();
export default billingService;
