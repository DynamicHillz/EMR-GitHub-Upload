/**
 * Check-In Appointment DTO
 *
 * Data Transfer Object for checking in a patient for their appointment
 */

export interface CheckInAppointmentDto {
  appointmentId: string;
}

export interface CheckInAppointmentResponse {
  success: boolean;
  message: string;
  appointment?: {
    id: string;
    patientId: string;
    doctorId: string;
    appointmentDate: Date;
    appointmentTime: string;
    status: string;
    checkedInAt: Date;
  };
  queuePosition?: number; // Position in the waiting queue
  error?: string;
}
