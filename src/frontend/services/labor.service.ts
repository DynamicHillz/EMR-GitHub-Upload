/**
 * Labor Module - API Service Layer
 */

import axios, { AxiosInstance } from 'axios';
import {
  LaborRecord,
  ActiveLaborWorklistItem,
  StartLaborDto,
  RecordObservationDto,
  RecordDeliveryOutcomeDto,
  PartographObservation,
} from '../types/labor';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`;

class LaborService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/labor`,
      headers: { 'Content-Type': 'application/json' },
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

  async getActiveLabors(): Promise<ActiveLaborWorklistItem[]> {
    const { data } = await this.api.get<ApiResponse<ActiveLaborWorklistItem[]>>('/worklist');
    return data.data || [];
  }

  async getLaborRecordByAdmission(admissionId: string): Promise<LaborRecord | null> {
    const { data } = await this.api.get<ApiResponse<LaborRecord | null>>(`/admissions/${admissionId}`);
    return data.data ?? null;
  }

  async startLabor(admissionId: string, dto: StartLaborDto): Promise<LaborRecord> {
    const { data } = await this.api.post<ApiResponse<LaborRecord>>(`/admissions/${admissionId}/start`, dto);
    if (!data.data) throw new Error('Failed to start labor tracking');
    return data.data;
  }

  async recordObservation(laborRecordId: string, dto: RecordObservationDto): Promise<PartographObservation> {
    const { data } = await this.api.post<ApiResponse<PartographObservation>>(`/records/${laborRecordId}/observations`, dto);
    if (!data.data) throw new Error('Failed to record observation');
    return data.data;
  }

  async recordDeliveryOutcome(
    laborRecordId: string,
    dto: RecordDeliveryOutcomeDto
  ): Promise<{ laborRecord: LaborRecord; pregnancyClosed: boolean }> {
    const { data } = await this.api.post<ApiResponse<{ laborRecord: LaborRecord; pregnancyClosed: boolean }>>(
      `/records/${laborRecordId}/delivery`,
      dto
    );
    if (!data.data) throw new Error('Failed to record delivery outcome');
    return data.data;
  }
}

export const laborService = new LaborService();
export default laborService;
