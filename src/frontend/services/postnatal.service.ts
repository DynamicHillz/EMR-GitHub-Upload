/**
 * Postnatal Module - API Service Layer
 *
 * Follows labor.service.ts's class + axios-instance + interceptor pattern
 * (the more robust of the two service patterns in this codebase — see
 * anc.service.ts for the plain-object alternative).
 */

import axios, { AxiosInstance } from 'axios';
import { PostnatalVisit, RecordPostnatalVisitDto, PostnatalWorklistItem } from '../types/postnatal';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`;

class PostnatalService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/postnatal`,
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

  async getVisitsByPatient(patientId: string, pregnancyId?: string): Promise<PostnatalVisit[]> {
    const { data } = await this.api.get<ApiResponse<PostnatalVisit[]>>(`/patient/${patientId}`, {
      params: pregnancyId ? { pregnancyId } : undefined,
    });
    return data.data || [];
  }

  async recordVisit(patientId: string, dto: RecordPostnatalVisitDto): Promise<PostnatalVisit> {
    const { data } = await this.api.post<ApiResponse<PostnatalVisit>>(`/patient/${patientId}`, dto);
    if (!data.data) throw new Error('Failed to record postnatal visit');
    return data.data;
  }

  async getWorklist(
    withinDays: number = 7,
    page: number = 1,
    limit: number = 50
  ): Promise<{ items: PostnatalWorklistItem[]; page: number; totalPages: number }> {
    const { data } = await this.api.get<ApiResponse<PostnatalWorklistItem[]> & { page: number; totalPages: number }>(
      '/worklist',
      { params: { withinDays, page, limit } }
    );
    return {
      items: data.data || [],
      page: data.page || 1,
      totalPages: data.totalPages || 1,
    };
  }

  async dismissDue(
    patientId: string,
    dto: { pregnancyId?: string; contactType: string; reason: string; reasonNotes?: string }
  ): Promise<void> {
    await this.api.post(`/due/${patientId}/dismiss`, dto);
  }
}

export const postnatalService = new PostnatalService();
export default postnatalService;
