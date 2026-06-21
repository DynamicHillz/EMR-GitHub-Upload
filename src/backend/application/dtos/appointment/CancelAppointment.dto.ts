/**
 * Cancel Appointment DTO
 *
 * Data Transfer Object for cancelling an appointment
 */

export interface CancelAppointmentDto {
  appointmentId: string;
  reason: string;
}

export interface CancelAppointmentResponse {
  success: boolean;
  message: string;
  appointment?: {
    id: string;
    patientId: string;
    doctorId: string;
    appointmentDate: Date;
    appointmentTime: string;
    status: string;
    cancelledAt: Date;
    cancellationReason: string;
  };
  error?: string;
}
