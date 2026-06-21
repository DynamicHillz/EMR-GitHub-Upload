/**
 * Create Appointment DTO
 *
 * Data Transfer Object for creating a new appointment
 * Used in the presentation layer (controllers) to validate incoming requests
 */

export interface CreateAppointmentDto {
  patientId: string;
  doctorId: string;
  appointmentDate: string; // ISO date string
  appointmentTime: string; // HH:MM format
  appointmentType: string;
  reason?: string;
  duration?: number; // in minutes, defaults to 30
}

export interface CreateAppointmentResponse {
  success: boolean;
  message: string;
  appointment?: {
    id: string;
    patientId: string;
    doctorId: string;
    appointmentDate: Date;
    appointmentTime: string;
    appointmentType: string;
    reason?: string;
    duration: number;
    status: string;
    createdAt: Date;
  };
  error?: string;
}
