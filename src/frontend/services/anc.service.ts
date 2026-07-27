import axios from 'axios';
import { AncPregnancy, AncVisit } from '../types/anc';

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : `${window.location.protocol}//${window.location.hostname}:3000/api`;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: { Authorization: `Bearer ${token}` }
  };
};

export const ancService = {
  getActivePregnancies: async (): Promise<any[]> => {
    const response = await axios.get(`${API_URL}/anc/active`, getAuthHeaders());
    return response.data;
  },

  getPregnancies: async (patientId: string): Promise<AncPregnancy[]> => {
    const response = await axios.get(`${API_URL}/anc/patient/${patientId}/pregnancies`, getAuthHeaders());
    return response.data;
  },

  createPregnancy: async (patientId: string, data: Partial<AncPregnancy>): Promise<AncPregnancy> => {
    const response = await axios.post(`${API_URL}/anc/patient/${patientId}/pregnancies`, data, getAuthHeaders());
    return response.data;
  },

  updatePregnancy: async (pregnancyId: string, data: Partial<AncPregnancy>): Promise<AncPregnancy> => {
    const response = await axios.put(`${API_URL}/anc/pregnancies/${pregnancyId}`, data, getAuthHeaders());
    return response.data;
  },

  getVisits: async (pregnancyId: string): Promise<AncVisit[]> => {
    const response = await axios.get(`${API_URL}/anc/pregnancies/${pregnancyId}/visits`, getAuthHeaders());
    return response.data;
  },

  createVisit: async (pregnancyId: string, data: Partial<AncVisit>): Promise<AncVisit> => {
    const response = await axios.post(`${API_URL}/anc/pregnancies/${pregnancyId}/visits`, data, getAuthHeaders());
    return response.data;
  }
};
