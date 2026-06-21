/**
 * Update Appointment DTO
 *
 * Data Transfer Object for updating an existing appointment
 */

import { AppointmentStatus } from '../../../domain/entities/Appointment';

export interface UpdateAppointmentDto {
  appointmentDate?: string; // ISO date string
  appointmentTime?: string; // HH:MM format
  appointmentType?: string;
  reason?: string;
  duration?: number;
  status?: AppointmentStatus;
}

export interface UpdateAppointmentResponse {
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
    updatedAt: Date;
  };
  error?: string;
}
