import axios from 'axios';
import { ImmunizationSchedule, PatientImmunization } from '../types/immunization';

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : `${window.location.protocol}//${window.location.hostname}:3000/api`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: { Authorization: `Bearer ${token}` }
  };
};

export const immunizationService = {
  getSchedule: async (): Promise<ImmunizationSchedule[]> => {
    const response = await axios.get(`${API_URL}/immunization/schedule`, getAuthHeaders());
    return response.data;
  },

  createScheduleItem: async (data: Partial<ImmunizationSchedule>): Promise<ImmunizationSchedule> => {
    const response = await axios.post(`${API_URL}/immunization/schedule`, data, getAuthHeaders());
    return response.data;
  },

  getPatientImmunizations: async (patientId: string): Promise<PatientImmunization[]> => {
    const response = await axios.get(`${API_URL}/immunization/patient/${patientId}`, getAuthHeaders());
    return response.data;
  },

  recordImmunization: async (patientId: string, data: Partial<PatientImmunization>): Promise<PatientImmunization> => {
    const response = await axios.post(`${API_URL}/immunization/patient/${patientId}`, data, getAuthHeaders());
    return response.data;
  },

  getOverdue: async (
    withinDays: number = 7,
    page: number = 1,
    limit: number = 50
  ): Promise<{ doses: any[]; page: number; totalPages: number }> => {
    const response = await axios.get(
      `${API_URL}/immunization/overdue?withinDays=${withinDays}&page=${page}&limit=${limit}`,
      getAuthHeaders()
    );
    return {
      doses: response.data.data || [],
      page: response.data.page || 1,
      totalPages: response.data.totalPages || 1,
    };
  },

  dismissDue: async (patientId: string, scheduleId: string, data: { reason: string; reasonNotes?: string }): Promise<void> => {
    await axios.post(`${API_URL}/immunization/due/${patientId}/${scheduleId}/dismiss`, data, getAuthHeaders());
  }
};
