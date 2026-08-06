/**
 * Reports Module - API Service Layer
 * Handles all API calls to the reporting/analytics endpoints
 */

import axios, { AxiosInstance } from 'axios';
import {
  ApiResponse,
  ReportDateParams,
  RankingReportParams,
  PatientVolumeReport,
  RevenueReport,
  DiagnosisTrendsReport,
  StockTurnoverReport,
  NoShowReport,
  NhmisMonthlyReturnParams,
  NhmisMonthlyReturnReport,
} from '../types/reports.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`;

class ReportsService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/reports`,
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

  async getPatientVolume(params: ReportDateParams): Promise<PatientVolumeReport> {
    const { data } = await this.api.get<ApiResponse<PatientVolumeReport>>('/patient-volume', { params });
    if (!data.data) throw new Error('Failed to fetch patient volume report');
    return data.data;
  }

  async getRevenue(params: ReportDateParams): Promise<RevenueReport> {
    const { data } = await this.api.get<ApiResponse<RevenueReport>>('/revenue', { params });
    if (!data.data) throw new Error('Failed to fetch revenue report');
    return data.data;
  }

  async getDiagnosisTrends(params: RankingReportParams): Promise<DiagnosisTrendsReport> {
    const { data } = await this.api.get<ApiResponse<DiagnosisTrendsReport>>('/diagnoses', { params });
    if (!data.data) throw new Error('Failed to fetch diagnosis trends report');
    return data.data;
  }

  async getStockTurnover(params: RankingReportParams): Promise<StockTurnoverReport> {
    const { data } = await this.api.get<ApiResponse<StockTurnoverReport>>('/stock-turnover', { params });
    if (!data.data) throw new Error('Failed to fetch stock turnover report');
    return data.data;
  }

  async getNoShowRate(params: ReportDateParams): Promise<NoShowReport> {
    const { data } = await this.api.get<ApiResponse<NoShowReport>>('/no-shows', { params });
    if (!data.data) throw new Error('Failed to fetch no-show report');
    return data.data;
  }

  async getNhmisMonthlyReturn(params: NhmisMonthlyReturnParams): Promise<NhmisMonthlyReturnReport> {
    const { data } = await this.api.get<ApiResponse<NhmisMonthlyReturnReport>>('/nhmis-monthly-return', { params });
    if (!data.data) throw new Error('Failed to fetch NHMIS monthly return');
    return data.data;
  }
}

export const reportsService = new ReportsService();
export default reportsService;
