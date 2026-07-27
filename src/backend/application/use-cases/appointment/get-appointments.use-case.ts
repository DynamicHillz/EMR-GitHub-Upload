/**
 * Get Appointments Use Case
 *
 * Handles retrieval and filtering of appointments
 */

import { IAppointmentRepository } from '../../../domain/interfaces/IAppointmentRepository';
import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { GetAppointmentsDto, GetAppointmentsResponse } from '../../dtos/appointment/GetAppointments.dto';
import { logger } from '../../../config/logger';

export class GetAppointmentsUseCase {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private patientRepository: IPatientRepository
  ) {}

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

      // Fetch unique patients to enrich appointments
      const uniquePatientIds = [...new Set(result.appointments.map(a => a.patientId))];
      const patients = await Promise.all(uniquePatientIds.map(id => this.patientRepository.findById(id, tenantId)));
      const patientMap = new Map(patients.filter((p): p is NonNullable<typeof p> => p !== null).map(p => [p.id, p]));

      return {
        success: true,
        message: `Found ${result.total} appointment(s)`,
        appointments: result.appointments.map(apt => {
          const patient = patientMap.get(apt.patientId);
          return {
            id: apt.id,
            patientId: apt.patientId,
            patientName: patient ? `${patient.firstName} ${patient.lastName}` : `Patient ${apt.patientId.substring(0, 8)}`,
            patientNumber: patient?.patientId,
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
          };
        }),
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
