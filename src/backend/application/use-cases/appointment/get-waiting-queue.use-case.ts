/**
 * Get Waiting Queue Use Case
 *
 * Retrieves the waiting queue for a specific doctor
 * (all checked-in patients ordered by check-in time)
 */

import { IAppointmentRepository } from '../../../domain/interfaces/IAppointmentRepository';
import { logger } from '../../../config/logger';

export interface GetWaitingQueueResponse {
  success: boolean;
  message: string;
  queue?: Array<{
    id: string;
    patientId: string;
    patientName?: string;
    appointmentTime: string;
    appointmentType: string;
    checkedInAt: Date;
    position: number;
  }>;
  error?: string;
}

export class GetWaitingQueueUseCase {
  constructor(private appointmentRepository: IAppointmentRepository) {}

  async execute(doctorId: string, tenantId: string): Promise<GetWaitingQueueResponse> {
    try {
      // Validate doctor ID
      if (!doctorId || doctorId.trim() === '') {
        return {
          success: false,
          message: 'Validation failed',
          error: 'Doctor ID is required',
        };
      }

      // Get waiting queue
      const appointments = await this.appointmentRepository.getWaitingQueue(doctorId, tenantId);

      // Map to response format with position
      const queue = appointments.map((apt, index) => ({
        id: apt.id,
        patientId: apt.patientId,
        patientName: apt.patient ? `${apt.patient.firstName} ${apt.patient.lastName}` : `Patient ${apt.patientId.substring(0, 8)}`,
        appointmentTime: apt.appointmentTime,
        appointmentType: apt.appointmentType,
        checkedInAt: apt.checkedInAt!,
        position: index + 1,
      }));

      return {
        success: true,
        message: `Found ${queue.length} patient(s) in waiting queue`,
        queue,
      };
    } catch (error) {
      logger.error('Error getting waiting queue:', error);
      return {
        success: false,
        message: 'Failed to retrieve waiting queue',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
