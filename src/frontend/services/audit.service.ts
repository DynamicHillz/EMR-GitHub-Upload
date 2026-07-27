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
  entityId: string;
  entityName?: string;
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
   * Fetch archived (soft-deleted) records for an entity
   */
  async getArchivedRecords(entityType: string): Promise<any[]> {
    const response = await this.api.get(`/audit/archive/${entityType}`);
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
