/**
 * Get Appointments Use Case
 *
 * Handles retrieval and filtering of appointments
 */

import { IAppointmentRepository } from '../../../domain/interfaces/IAppointmentRepository';
import { GetAppointmentsDto, GetAppointmentsResponse } from '../../dtos/appointment/GetAppointments.dto';
import { logger } from '../../../config/logger';

export class GetAppointmentsUseCase {
  constructor(private appointmentRepository: IAppointmentRepository) {}

  async execute(dto: GetAppointmentsDto, tenantId: string): Promise<GetAppointmentsResponse> {
    try {
      // Parse dates if provided
      const date = dto.date ? new Date(dto.date) : undefined;
      const dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : undefined;
      const dateTo = dto.dateTo ? new Date(dto.dateTo) : undefined;

      // Search appointments with criteria
      const result = await this.appointmentRepository.search({
        tenantId,
        doctorId: dto.doctorId,
        patientId: dto.patientId,
        date,
        dateFrom,
        dateTo,
        status: dto.status,
        skip: dto.skip || 0,
        take: dto.take || 50,
      });

      return {
        success: true,
        message: `Found ${result.total} appointment(s)`,
        appointments: result.appointments.map(apt => ({
          id: apt.id,
          patientId: apt.patientId,
          doctorId: apt.doctorId,
          appointmentDate: apt.appointmentDate,
          appointmentTime: apt.appointmentTime,
          appointmentType: apt.appointmentType,
          reason: apt.reason,
          duration: apt.duration,
          status: apt.status,
          checkedInAt: apt.checkedInAt,
          completedAt: apt.completedAt,
          cancelledAt: apt.cancelledAt,
          cancellationReason: apt.cancellationReason,
          createdAt: apt.createdAt,
          updatedAt: apt.updatedAt,
        })),
        total: result.total,
      };
    } catch (error) {
      logger.error('Error getting appointments:', error);
      return {
        success: false,
        message: 'Failed to retrieve appointments',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
