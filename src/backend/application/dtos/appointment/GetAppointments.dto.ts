/**
 * Get Appointments DTO
 *
 * Data Transfer Object for searching/filtering appointments
 */

import { AppointmentStatus } from '../../../domain/entities/Appointment';

export interface GetAppointmentsDto {
  doctorId?: string;
  patientId?: string;
  date?: string; // ISO date string for specific date
  dateFrom?: string; // ISO date string for range start
  dateTo?: string; // ISO date string for range end
  status?: AppointmentStatus;
  skip?: number;
  take?: number;
}

export interface GetAppointmentsResponse {
  success: boolean;
  message: string;
  appointments?: Array<{
    id: string;
    patientId: string;
    doctorId: string;
    appointmentDate: Date;
    appointmentTime: string;
    appointmentType: string;
    reason?: string;
    duration: number;
    status: string;
    checkedInAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    cancellationReason?: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  total?: number;
  error?: string;
}
