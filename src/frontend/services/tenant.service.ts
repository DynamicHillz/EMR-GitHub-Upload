/**
 * Tenant Management Service
 * SUPER_ADMIN-only clinic (tenant) CRUD API calls
 */

import axios, { AxiosInstance } from 'axios';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  clinicName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  subscriptionTier: string;
  subscriptionStart: string;
  subscriptionEnd: string | null;
  createdAt: string;
  _count?: { users: number; patients: number };
}

export interface CreateTenantDto {
  name: string;
  slug: string;
  clinicName: string;
  address?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string;
  subscriptionTier?: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
  adminPhone?: string;
}

export interface ListTenantsResponse {
  success: boolean;
  data: Tenant[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`;

class TenantService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
    });

    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  async listTenants(params?: { page?: number; limit?: number; search?: string; status?: string }): Promise<ListTenantsResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);

    const response = await this.api.get<ListTenantsResponse>(`/tenants?${query.toString()}`);
    return response.data;
  }

  async createTenant(data: CreateTenantDto): Promise<ApiResponse<{ tenant: Tenant }>> {
    const response = await this.api.post<ApiResponse<{ tenant: Tenant }>>('/tenants', data);
    return response.data;
  }

  async updateTenantStatus(id: string, status: string): Promise<ApiResponse<Tenant>> {
    const response = await this.api.patch<ApiResponse<Tenant>>(`/tenants/${id}/status`, { status });
    return response.data;
  }
}

export default new TenantService();
