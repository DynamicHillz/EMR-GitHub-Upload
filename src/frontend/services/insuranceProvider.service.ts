/**
 * Insurance Provider Service
 * (Distinct from a patient's InsuranceService for claims/policies — this is
 * just the admin CRUD for the provider directory itself: NHIA/HMO/PRIVATE.)
 */

import axios, { AxiosInstance } from 'axios';

export interface InsuranceProvider {
  id: string;
  tenantId: string;
  name: string;
  type: 'NHIA' | 'HMO' | 'PRIVATE';
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceProviderInput {
  name: string;
  type: 'NHIA' | 'HMO' | 'PRIVATE';
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  isActive?: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`;

class InsuranceProviderService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
    });
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  async getProviders(): Promise<InsuranceProvider[]> {
    const response = await this.api.get<InsuranceProvider[]>('/insurance/providers');
    return response.data;
  }

  async createProvider(data: InsuranceProviderInput): Promise<InsuranceProvider> {
    const response = await this.api.post<InsuranceProvider>('/insurance/providers', data);
    return response.data;
  }

  async updateProvider(id: string, data: Partial<InsuranceProviderInput>): Promise<InsuranceProvider> {
    const response = await this.api.put<InsuranceProvider>(`/insurance/providers/${id}`, data);
    return response.data;
  }
}

export default new InsuranceProviderService();
