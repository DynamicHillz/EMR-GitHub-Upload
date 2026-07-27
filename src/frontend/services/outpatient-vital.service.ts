const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL 
    ? `${import.meta.env.VITE_API_URL}/api`
    : `${window.location.protocol}//${window.location.hostname}:3000/api`;
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export interface OutpatientVital {
  id: string;
  tenantId: string;
  patientId: string;
  recordedById: string;
  appointmentId?: string;
  consultationId?: string;
  bloodPressure?: string;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  headCircumference?: number;
  muac?: number;
  spO2?: number;
  bmi?: number;
  zScoreWeightForAge?: number;
  zScoreHeightForAge?: number;
  zScoreWeightForHeight?: number;
  zScoreBMIForAge?: number;
  notes?: string;
  recordedAt: string;
  recordedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

class OutpatientVitalService {
  async recordVitals(data: any): Promise<OutpatientVital> {
    const response = await fetch(`${getApiBaseUrl()}/outpatient-vitals`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to record vitals');
    }
    const result = await response.json();
    return result.data;
  }

  async getPatientVitals(patientId: string): Promise<OutpatientVital[]> {
    const response = await fetch(`${getApiBaseUrl()}/outpatient-vitals/patient/${patientId}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) return [];
    const result = await response.json();
    return result.data;
  }

  async getLatestVitalsToday(patientId: string): Promise<OutpatientVital | null> {
    const response = await fetch(`${getApiBaseUrl()}/outpatient-vitals/patient/${patientId}/today`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.data;
  }
}

export default new OutpatientVitalService();
