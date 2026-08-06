import axios, { AxiosInstance } from 'axios';
import { Ward, Admission, WardRound, MedicationAdministration, OperationNote, OperationNotesLogResponse, OverstayStatus, MedicationWarning } from '../types/inpatient';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  if (port === '5173') {
    return `${protocol}//${hostname}:3000/api`;
  }
  return `${window.location.origin}/api`;
};

const API_BASE_URL = getApiBaseUrl();

class InpatientService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/inpatients`,
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
  }

  async getWards(status?: 'ACTIVE' | 'INACTIVE'): Promise<Ward[]> {
    const response = await this.api.get('/wards', { params: status ? { status } : undefined });
    return response.data;
  }

  async createWard(data: any): Promise<Ward> {
    const response = await this.api.post('/wards', data);
    return response.data;
  }

  async updateWard(id: string, data: any): Promise<Ward> {
    const response = await this.api.put(`/wards/${id}`, data);
    return response.data;
  }

  async deleteWard(id: string): Promise<void> {
    await this.api.delete(`/wards/${id}`);
  }

  async reactivateWard(id: string): Promise<Ward> {
    const response = await this.api.post(`/wards/${id}/reactivate`);
    return response.data;
  }

  async getAdmissions(status?: string): Promise<Admission[]> {
    const response = await this.api.get('/admissions', { params: { status } });
    return response.data;
  }

  async getAdmissionById(id: string): Promise<Admission> {
    const response = await this.api.get(`/admissions/${id}`);
    return response.data;
  }

  async admitPatient(data: { patientId: string; bedId: string; reason: string; notes?: string; isolationRequired?: boolean; infectionRisk?: string; primaryDiagnosisId?: string; admissionType?: string; showOperationNote?: boolean; showPartograph?: boolean }): Promise<Admission> {
    const response = await this.api.post('/admissions', data);
    return response.data;
  }

  async updateAdmissionSettings(id: string, data: { admissionType?: string; showOperationNote?: boolean; showPartograph?: boolean; showOxygen?: boolean }): Promise<Admission> {
    const response = await this.api.put(`/admissions/${id}/settings`, data);
    return response.data;
  }

  async dischargePatient(id: string, data: {
    notes?: string, finalNotes?: string, followUpPlan?: string, finalDiagnosisId?: string, ttoMedications?: any, prescriptions?: any[],
    // Maternity-specific — only sent when the admission has a linked, delivered LaborRecord.
    breastfeedingCounselingDone?: boolean, familyPlanningMethodDiscussed?: string, newbornDangerSignsCounseled?: boolean,
    postnatalFollowUpDate?: string, maternalConditionAtDischarge?: string, maternalConditionNotes?: string,
    newbornConditionAtDischarge?: string, newbornConditionNotes?: string,
  }): Promise<Admission & { bedCleared: boolean; medicationWarnings?: MedicationWarning[] }> {
    const response = await this.api.post(`/admissions/${id}/discharge`, data);
    return response.data;
  }

  async getOverstayStatus(): Promise<OverstayStatus[]> {
    const response = await this.api.get('/admissions/overstay-status');
    return response.data;
  }

  async confirmBedVacated(id: string): Promise<Admission> {
    const response = await this.api.post(`/admissions/${id}/confirm-bed-vacated`);
    return response.data;
  }

  async transferPatient(id: string, data: { toBedId: string; reason: string }): Promise<any> {
    const response = await this.api.post(`/admissions/${id}/transfer`, data);
    return response.data;
  }

  async addWardRound(id: string, data: {
    notes: string;
    vitals?: any;
    plan?: string;
    medicationChanges?: Array<{
      action: 'ADD' | 'DISCONTINUE';
      prescriptionId?: string;
      medicationId?: string;
      medicationName?: string;
      route?: string;
      dosage?: string;
      frequency?: string;
      duration?: string;
      instructions?: string;
    }>;
  }): Promise<WardRound> {
    const response = await this.api.post(`/admissions/${id}/ward-rounds`, data);
    return response.data;
  }

  async addMedicationAdministration(id: string, data: { medicationName: string; dosage: string; prescriptionId?: string; notes?: string; status?: string }): Promise<MedicationAdministration> {
    const response = await this.api.post(`/admissions/${id}/medications`, data);
    return response.data;
  }

  async getAdmissionsByPatientId(patientId: string): Promise<Admission[]> {
    const response = await this.api.get(`/admissions/patient/${patientId}`);
    return response.data.data || response.data;
  }

  async updateBed(id: string, data: { bedNumber?: string; type?: string; status?: string }) {
    const response = await this.api.put(`/beds/${id}`, data);
    return response.data.data || response.data;
  }

  // Charts
  async getCharts(id: string): Promise<any> {
    const response = await this.api.get(`/admissions/${id}/charts`);
    return response.data;
  }

  async addVitalChart(id: string, data: any): Promise<any> {
    const response = await this.api.post(`/admissions/${id}/vitals`, data);
    return response.data;
  }

  async addFluidChart(id: string, data: any): Promise<any> {
    const response = await this.api.post(`/admissions/${id}/fluids`, data);
    return response.data;
  }

  async addTransfusionChart(id: string, data: any): Promise<any> {
    const response = await this.api.post(`/admissions/${id}/transfusions`, data);
    return response.data;
  }

  async addBloodSugarChart(id: string, data: any): Promise<any> {
    const response = await this.api.post(`/admissions/${id}/blood-sugar`, data);
    return response.data;
  }

  // Operation Notes (now includes the postop plan — see OperationNoteTab)
  async getOperationNotes(id: string): Promise<OperationNote[]> {
    const response = await this.api.get(`/admissions/${id}/operation-notes`);
    return response.data;
  }

  async addOperationNote(id: string, data: any): Promise<OperationNote> {
    const response = await this.api.post(`/admissions/${id}/operation-notes`, data);
    return response.data;
  }

  // Every operation note recorded at this clinic, across all patients/
  // admissions and regardless of which doctor recorded it — powers
  // SurgeryLogPage.tsx.
  async getAllOperationNotes(params: {
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
    sortBy?: 'operationDate' | 'surgicalProcedure';
    sortDir?: 'asc' | 'desc';
  }): Promise<OperationNotesLogResponse> {
    const response = await this.api.get('/operation-notes', { params });
    return response.data;
  }

  // Count of operations per surgicalProcedure in a date range — powers the
  // Analytics tab on SurgeryLogPage.tsx.
  async getSurgicalProcedureBreakdown(params: { from?: string; to?: string; limit?: number }): Promise<{
    topProcedures: { name: string; count: number }[];
    summary: { totalOperationsRecorded: number; startDate: string | null; endDate: string | null };
  }> {
    const response = await this.api.get('/operation-notes/analytics', { params });
    return response.data;
  }

  // Void / Corrections
  async voidWardRound(admissionId: string, recordId: string, reason: string): Promise<void> {
    await this.api.delete(`/admissions/${admissionId}/ward-rounds/${recordId}`, { data: { reason } });
  }

  async voidVitalChart(admissionId: string, recordId: string, reason: string): Promise<void> {
    await this.api.delete(`/admissions/${admissionId}/vitals/${recordId}`, { data: { reason } });
  }

  async voidFluidChart(admissionId: string, recordId: string, reason: string): Promise<void> {
    await this.api.delete(`/admissions/${admissionId}/fluids/${recordId}`, { data: { reason } });
  }

  async voidTransfusionChart(admissionId: string, recordId: string, reason: string): Promise<void> {
    await this.api.delete(`/admissions/${admissionId}/transfusions/${recordId}`, { data: { reason } });
  }

  async voidBloodSugarChart(admissionId: string, recordId: string, reason: string): Promise<void> {
    await this.api.delete(`/admissions/${admissionId}/blood-sugar/${recordId}`, { data: { reason } });
  }

  async voidOperationNote(admissionId: string, recordId: string, reason: string): Promise<void> {
    await this.api.delete(`/admissions/${admissionId}/operation-notes/${recordId}`, { data: { reason } });
  }
}

export default new InpatientService();
