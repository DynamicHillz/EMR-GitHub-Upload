/**
 * Book Appointment Use Case
 *
 * Handles the business logic for booking a new appointment
 * Includes double-booking prevention and validation
 */

import { Prisma } from '@prisma/client';
import { IAppointmentRepository } from '../../../domain/interfaces/IAppointmentRepository';
import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { CreateAppointmentDto, CreateAppointmentResponse } from '../../dtos/appointment/CreateAppointment.dto';
import { AppointmentValidator } from '../../validators/appointment.validator';
import { logger } from '../../../config/logger';

export class BookAppointmentUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private patientRepository: IPatientRepository
  ) {}

  async execute(dto: CreateAppointmentDto, tenantId: string): Promise<CreateAppointmentResponse> {
    try {
      // 1. Validate input data
      const validation = AppointmentValidator.validateCreateAppointment(dto);
      if (!validation.valid) {
        return {
          success: false,
          message: 'Validation failed',
          error: validation.errors.join(', '),
        };
      }

      // 2. Verify patient exists and belongs to tenant
      const patient = await this.patientRepository.findById(dto.patientId, tenantId);
      if (!patient) {
        return {
          success: false,
          message: 'Patient not found',
          error: 'The specified patient does not exist or does not belong to this organization',
        };
      }

      // 3. Check for double-booking (overlapping appointments)
      const appointmentDate = new Date(dto.appointmentDate);
      const duration = dto.duration || 30;
      const endTime = this.calculateEndTime(dto.appointmentTime, duration);

      const overlapping = await this.appointmentRepository.findOverlapping({
        doctorId: dto.doctorId,
        tenantId,
        date: appointmentDate,
        startTime: dto.appointmentTime,
        endTime,
      });

      if (overlapping.length > 0) {
        return {
          success: false,
          message: 'Time slot unavailable',
          error: `This time slot conflicts with an existing appointment. Please choose a different time.`,
        };
      }

      // 4. Create the appointment
      const appointment = await this.appointmentRepository.create({
        tenantId,
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        appointmentDate,
        appointmentTime: dto.appointmentTime,
        appointmentType: dto.appointmentType,
        reason: dto.reason,
        duration,
      });

      return {
        success: true,
        message: 'Appointment booked successfully',
        appointment: {
          id: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          appointmentType: appointment.appointmentType,
          reason: appointment.reason,
          duration: appointment.duration,
          status: appointment.status,
          createdAt: appointment.createdAt,
        },
      };
    } catch (error) {
      // A partial unique index on the DB backs the findOverlapping check
      // above with a real atomicity guarantee — two concurrent requests can
      // both pass the check-then-act findOverlapping call, but only one can
      // win the insert; the loser hits this P2002, not a generic overlap.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return {
          success: false,
          message: 'Time slot unavailable',
          error: 'This slot was just booked by someone else — please pick another time.',
        };
      }

      logger.error('Error booking appointment:', error);
      return {
        success: false,
        message: 'Failed to book appointment',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Helper: Calculate end time from start time and duration
   */
  private calculateEndTime(startTime: string, duration: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  }
}
