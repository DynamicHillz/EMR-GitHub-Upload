/**
 * License Module - API Service Layer
 * On-premise license status + renewal (SUPER_ADMIN for renewal only).
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`;

export type LicenseStatus = 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'MISSING' | 'INVALID';

export interface LicenseClaims {
  clinicName: string;
  licenseIssuedAt: string;
  maintenanceExpiresAt: string;
}

export interface LicenseStatusResult {
  status: LicenseStatus;
  claims: LicenseClaims | null;
  daysRemaining: number | null;
}

class LicenseService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/license`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async getStatus(): Promise<LicenseStatusResult> {
    const { data } = await this.api.get<{ success: boolean; data: LicenseStatusResult }>('/status');
    return data.data;
  }

  async updateLicense(licenseToken: string): Promise<void> {
    await this.api.put('/', { licenseToken });
  }
}

export const licenseService = new LicenseService();
export default licenseService;
