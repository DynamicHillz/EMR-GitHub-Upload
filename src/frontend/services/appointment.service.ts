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

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  reason?: string;
  status: string;
  patientName?: string;
  patientNumber?: string;
  doctorName?: string;
}

class AppointmentService {
  async getAppointments(date?: string, status?: string): Promise<Appointment[]> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (status) params.append('status', status);
    
    const response = await fetch(`${getApiBaseUrl()}/appointments?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) return [];
    const result = await response.json();
    return result.appointments || [];
  }
}

export default new AppointmentService();
