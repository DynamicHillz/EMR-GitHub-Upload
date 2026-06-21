/**
 * Appointment Validator
 *
 * Validates appointment-related data to ensure business rules are met
 * before processing requests
 */

import { CreateAppointmentDto } from '../dtos/appointment/CreateAppointment.dto';
import { UpdateAppointmentDto } from '../dtos/appointment/UpdateAppointment.dto';

export class AppointmentValidator {
  /**
   * Validate create appointment data
   */
  static validateCreateAppointment(dto: CreateAppointmentDto): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!dto.patientId || dto.patientId.trim() === '') {
      errors.push('Patient ID is required');
    }

    if (!dto.doctorId || dto.doctorId.trim() === '') {
      errors.push('Doctor ID is required');
    }

    if (!dto.appointmentDate || dto.appointmentDate.trim() === '') {
      errors.push('Appointment date is required');
    } else {
      // Validate date format and that it's not in the past
      const appointmentDate = new Date(dto.appointmentDate);
      if (isNaN(appointmentDate.getTime())) {
        errors.push('Invalid appointment date format');
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (appointmentDate < today) {
          errors.push('Appointment date cannot be in the past');
        }
      }
    }

    if (!dto.appointmentTime || dto.appointmentTime.trim() === '') {
      errors.push('Appointment time is required');
    } else {
      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(dto.appointmentTime)) {
        errors.push('Invalid appointment time format. Expected HH:MM (e.g., 09:30)');
      }
    }

    if (!dto.appointmentType || dto.appointmentType.trim() === '') {
      errors.push('Appointment type is required');
    }

    // Optional duration validation
    if (dto.duration !== undefined) {
      if (dto.duration < 5 || dto.duration > 480) {
        errors.push('Duration must be between 5 and 480 minutes');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate update appointment data
   */
  static validateUpdateAppointment(dto: UpdateAppointmentDto): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // At least one field must be provided
    const hasUpdate =
      dto.appointmentDate !== undefined ||
      dto.appointmentTime !== undefined ||
      dto.appointmentType !== undefined ||
      dto.reason !== undefined ||
      dto.duration !== undefined ||
      dto.status !== undefined;

    if (!hasUpdate) {
      errors.push('At least one field must be provided for update');
    }

    // Validate date if provided
    if (dto.appointmentDate !== undefined) {
      const appointmentDate = new Date(dto.appointmentDate);
      if (isNaN(appointmentDate.getTime())) {
        errors.push('Invalid appointment date format');
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (appointmentDate < today) {
          errors.push('Appointment date cannot be in the past');
        }
      }
    }

    // Validate time if provided
    if (dto.appointmentTime !== undefined) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(dto.appointmentTime)) {
        errors.push('Invalid appointment time format. Expected HH:MM (e.g., 09:30)');
      }
    }

    // Validate duration if provided
    if (dto.duration !== undefined) {
      if (dto.duration < 5 || dto.duration > 480) {
        errors.push('Duration must be between 5 and 480 minutes');
      }
    }

    // Validate status if provided
    if (dto.status !== undefined) {
      const validStatuses = ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
      if (!validStatuses.includes(dto.status)) {
        errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate cancellation reason
   */
  static validateCancellationReason(reason: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!reason || reason.trim() === '') {
      errors.push('Cancellation reason is required');
    } else if (reason.length < 3) {
      errors.push('Cancellation reason must be at least 3 characters');
    } else if (reason.length > 500) {
      errors.push('Cancellation reason must not exceed 500 characters');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate appointment ID
   */
  static validateAppointmentId(id: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!id || id.trim() === '') {
      errors.push('Appointment ID is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
