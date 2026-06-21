/**
 * Check-In Appointment Use Case
 *
 * Handles checking in a patient for their appointment
 * and calculating their position in the waiting queue
 */

import { IAppointmentRepository } from '../../../domain/interfaces/IAppointmentRepository';
import { CheckInAppointmentResponse } from '../../dtos/appointment/CheckInAppointment.dto';
import { AppointmentValidator } from '../../validators/appointment.validator';
import { logger } from '../../../config/logger';

export class CheckInAppointmentUseCase {
  constructor(private appointmentRepository: IAppointmentRepository) {}

  async execute(appointmentId: string, tenantId: string): Promise<CheckInAppointmentResponse> {
    try {
      // 1. Validate appointment ID
      const validation = AppointmentValidator.validateAppointmentId(appointmentId);
      if (!validation.valid) {
        return {
          success: false,
          message: 'Validation failed',
          error: validation.errors.join(', '),
        };
      }

      // 2. Get the appointment
      const appointment = await this.appointmentRepository.findById(appointmentId, tenantId);
      if (!appointment) {
        return {
          success: false,
          message: 'Appointment not found',
          error: 'The specified appointment does not exist or does not belong to this organization',
        };
      }

      // 3. Check if appointment can be checked in
      if (appointment.status !== 'SCHEDULED') {
        return {
          success: false,
          message: 'Cannot check in',
          error: `Appointment is ${appointment.status}. Only SCHEDULED appointments can be checked in.`,
        };
      }

      // 4. Check in the appointment
      const checkedInAppointment = await this.appointmentRepository.checkIn(appointmentId, tenantId);

      // 5. Get waiting queue position
      const queue = await this.appointmentRepository.getWaitingQueue(appointment.doctorId, tenantId);
      const queuePosition = queue.findIndex(apt => apt.id === appointmentId) + 1;

      return {
        success: true,
        message: 'Patient checked in successfully',
        appointment: {
          id: checkedInAppointment.id,
          patientId: checkedInAppointment.patientId,
          doctorId: checkedInAppointment.doctorId,
          appointmentDate: checkedInAppointment.appointmentDate,
          appointmentTime: checkedInAppointment.appointmentTime,
          status: checkedInAppointment.status,
          checkedInAt: checkedInAppointment.checkedInAt!,
        },
        queuePosition,
      };
    } catch (error) {
      logger.error('Error checking in appointment:', error);
      return {
        success: false,
        message: 'Failed to check in',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
