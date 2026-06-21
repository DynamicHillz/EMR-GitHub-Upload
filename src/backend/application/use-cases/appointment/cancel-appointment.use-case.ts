/**
 * Cancel Appointment Use Case
 *
 * Handles cancelling an appointment with a reason
 */

import { IAppointmentRepository } from '../../../domain/interfaces/IAppointmentRepository';
import { CancelAppointmentResponse } from '../../dtos/appointment/CancelAppointment.dto';
import { AppointmentValidator } from '../../validators/appointment.validator';
import { logger } from '../../../config/logger';

export class CancelAppointmentUseCase {
  constructor(private appointmentRepository: IAppointmentRepository) {}

  async execute(appointmentId: string, reason: string, tenantId: string): Promise<CancelAppointmentResponse> {
    try {
      // 1. Validate appointment ID
      const idValidation = AppointmentValidator.validateAppointmentId(appointmentId);
      if (!idValidation.valid) {
        return {
          success: false,
          message: 'Validation failed',
          error: idValidation.errors.join(', '),
        };
      }

      // 2. Validate cancellation reason
      const reasonValidation = AppointmentValidator.validateCancellationReason(reason);
      if (!reasonValidation.valid) {
        return {
          success: false,
          message: 'Validation failed',
          error: reasonValidation.errors.join(', '),
        };
      }

      // 3. Get the appointment
      const appointment = await this.appointmentRepository.findById(appointmentId, tenantId);
      if (!appointment) {
        return {
          success: false,
          message: 'Appointment not found',
          error: 'The specified appointment does not exist or does not belong to this organization',
        };
      }

      // 4. Check if appointment can be cancelled
      if (appointment.status === 'CANCELLED') {
        return {
          success: false,
          message: 'Already cancelled',
          error: 'This appointment has already been cancelled',
        };
      }

      if (appointment.status === 'COMPLETED' || appointment.status === 'NO_SHOW') {
        return {
          success: false,
          message: 'Cannot cancel',
          error: `Cannot cancel an appointment that is ${appointment.status}`,
        };
      }

      // 5. Cancel the appointment
      const cancelledAppointment = await this.appointmentRepository.cancel(appointmentId, tenantId, reason);

      return {
        success: true,
        message: 'Appointment cancelled successfully',
        appointment: {
          id: cancelledAppointment.id,
          patientId: cancelledAppointment.patientId,
          doctorId: cancelledAppointment.doctorId,
          appointmentDate: cancelledAppointment.appointmentDate,
          appointmentTime: cancelledAppointment.appointmentTime,
          status: cancelledAppointment.status,
          cancelledAt: cancelledAppointment.cancelledAt!,
          cancellationReason: cancelledAppointment.cancellationReason!,
        },
      };
    } catch (error) {
      logger.error('Error cancelling appointment:', error);
      return {
        success: false,
        message: 'Failed to cancel appointment',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
