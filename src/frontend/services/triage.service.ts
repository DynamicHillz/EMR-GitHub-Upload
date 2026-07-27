const getApiBaseUrl = () => {
  return `${import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`}/api`;
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export interface TriageRecord {
  id: string;
  tenantId: string;
  patientId: string;
  appointmentId?: string;
  chiefComplaint: string;
  category: 'RESUSCITATION' | 'EMERGENT' | 'URGENT' | 'SEMI_URGENT' | 'NON_URGENT';
  triageNurseId: string;
  triageTime: string;
  
  systolicBP?: number;
  diastolicBP?: number;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  spO2?: number;
  weight?: number;
  painScore?: number;
  glucoseLevel?: number;
  consciousnessLevel?: string;
  
  muac?: number;
  isDehydrated?: boolean;
  
  dispositionNotes?: string;
  seenByDoctorAt?: string;
  waitingTimeMinutes?: number;
  
  patient?: any;
  triageNurse?: any;
}

class TriageService {
  async getQueue(): Promise<TriageRecord[]> {
    const response = await fetch(`${getApiBaseUrl()}/triage/queue`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch triage queue');
    return response.json();
  }

  async getPatientTriageHistory(patientId: string): Promise<TriageRecord[]> {
    const response = await fetch(`${getApiBaseUrl()}/triage/patient/${patientId}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return [];
    return response.json();
  }

  async createRecord(data: Partial<TriageRecord>): Promise<TriageRecord> {
    const response = await fetch(`${getApiBaseUrl()}/triage`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to create triage record');
    }
    return response.json();
  }

  async markAsSeen(id: string): Promise<TriageRecord> {
    const response = await fetch(`${getApiBaseUrl()}/triage/${id}/seen`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to mark as seen');
    return response.json();
  }
}

export default new TriageService();
