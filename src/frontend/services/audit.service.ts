import axios, { AxiosInstance } from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:3000/api`;
};

export interface AuditLog {
  id: string;
  userId: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName?: string | null;
  oldValues: string;
  newValues: string;
  ipAddress: string;
  userAgent?: string;
  metadata?: string;
  timestamp: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

export interface InvoiceAuditLogEntry {
  id: string;
  invoiceId: string;
  userId: string;
  action: string;
  previousValues: any;
  newValues: any;
  notes: string | null;
  createdAt: string;
}

export interface PaymentAuditLogEntry {
  id: string;
  paymentId: string;
  userId: string;
  action: string;
  previousValues: any;
  newValues: any;
  changesSummary: string | null;
  notes: string | null;
  createdAt: string;
}

class AuditService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: getApiBaseUrl(),
    });

    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /**
   * Fetch paginated audit logs
   */
  async getAuditLogs(page: number = 1, limit: number = 50, filters?: { startDate?: string, endDate?: string, entityType?: string, action?: string, search?: string }): Promise<AuditLogsResponse> {
    const params = { page, limit, ...filters };
    const response = await this.api.get('/audit/logs', { params });
    return response.data.data;
  }

  /**
   * Fetch archived (soft-deleted) records for an entity. Defaults to the
   * last 90 days server-side — pass sinceDate (ISO string) to widen the
   * window when looking for something older.
   */
  async getArchivedRecords(
    entityType: string,
    params: { page?: number; limit?: number; sinceDate?: string } = {}
  ): Promise<{ records: any[]; total: number; page: number; totalPages: number }> {
    const response = await this.api.get(`/audit/archive/${entityType}`, { params });
    return {
      records: response.data.data,
      total: response.data.total,
      page: response.data.page,
      totalPages: response.data.totalPages,
    };
  }

  /**
   * Fetch the full InvoiceAuditLog trail for one invoice — richer detail
   * (previous/new values, notes) than the generic AuditLog entry.
   */
  async getInvoiceAuditTrail(invoiceId: string): Promise<InvoiceAuditLogEntry[]> {
    const response = await this.api.get(`/audit/invoice-logs/${invoiceId}`);
    return response.data.data;
  }

  /**
   * Fetch the full PaymentAuditLog trail for one payment — fraud-prevention
   * detail (flag reasons, approver names) never shown elsewhere.
   */
  async getPaymentAuditTrail(paymentId: string): Promise<PaymentAuditLogEntry[]> {
    const response = await this.api.get(`/audit/payment-logs/${paymentId}`);
    return response.data.data;
  }

  /**
   * Restore a soft-deleted record
   */
  async restoreRecord(entityType: string, id: string): Promise<{ success: boolean; message: string }> {
    const response = await this.api.post(`/audit/archive/${entityType}/${id}/restore`);
    return response.data;
  }
}

export const auditService = new AuditService();
