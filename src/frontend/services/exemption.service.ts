/**
 * Exemption Policy Service
 */

import axios, { AxiosInstance } from 'axios';

export interface ExemptionPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  criteriaType: 'AGE' | 'CONDITION' | 'CUSTOM';
  criteriaValue: string;
  discountPercentage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExemptionPolicyInput {
  name: string;
  description?: string;
  criteriaType: 'AGE' | 'CONDITION' | 'CUSTOM';
  criteriaValue: string;
  discountPercentage: number;
  isActive?: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`;

class ExemptionService {
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

  async getPolicies(): Promise<ExemptionPolicy[]> {
    const response = await this.api.get<ExemptionPolicy[]>('/exemptions');
    return response.data;
  }

  async createPolicy(data: ExemptionPolicyInput): Promise<ExemptionPolicy> {
    const response = await this.api.post<ExemptionPolicy>('/exemptions', data);
    return response.data;
  }

  async updatePolicy(id: string, data: Partial<ExemptionPolicyInput>): Promise<ExemptionPolicy> {
    const response = await this.api.put<ExemptionPolicy>(`/exemptions/${id}`, data);
    return response.data;
  }
}

export default new ExemptionService();
