/**
 * Appointment Validator
 *
 * Validates appointment-related data to ensure business rules are met
 * before processing requests
 */

import { CreateAppointmentDto } from '../dtos/appointment/CreateAppointment.dto';
import { UpdateAppointmentDto } from '../dtos/appointment/UpdateAppointment.dto';

/**
 * Parses a date-only "YYYY-MM-DD" string (what the frontend date picker
 * always sends — see BookAppointmentModal.tsx's format(date, 'yyyy-MM-dd'))
 * as a LOCAL midnight Date. `new Date("2026-08-02")` parses that same string
 * as UTC midnight per the ISO 8601 spec, which silently shifts the calendar
 * day on any server not running in UTC (e.g. Africa/Lagos, UTC+1) — the
 * appointment date is always meant as the clinic's own local calendar day.
 */
function parseCalendarDate(dateStr: string): Date {
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const trimmed = dateStr.trim();
  if (isoDateOnly.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(trimmed);
}

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

    let parsedDate: Date | null = null;
    if (!dto.appointmentDate || dto.appointmentDate.trim() === '') {
      errors.push('Appointment date is required');
    } else {
      // Validate date format and that it's not in the past
      const appointmentDate = parseCalendarDate(dto.appointmentDate);
      if (isNaN(appointmentDate.getTime())) {
        errors.push('Invalid appointment date format');
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (appointmentDate < today) {
          errors.push('Appointment date cannot be in the past');
        } else {
          parsedDate = appointmentDate;
        }
      }
    }

    let timeValid = false;
    if (!dto.appointmentTime || dto.appointmentTime.trim() === '') {
      errors.push('Appointment time is required');
    } else {
      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(dto.appointmentTime)) {
        errors.push('Invalid appointment time format. Expected HH:MM (e.g., 09:30)');
      } else {
        timeValid = true;
      }
    }

    // The date-only check above accepts any time on today's date, including
    // one that has already passed (e.g. booking "today at 06:00" at 3pm) —
    // catch that here now that both the date and time are known-valid.
    if (parsedDate && timeValid) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsedDate.getTime() === today.getTime()) {
        const [hours, minutes] = dto.appointmentTime.split(':').map(Number);
        const proposedDateTime = new Date();
        proposedDateTime.setHours(hours, minutes, 0, 0);
        if (proposedDateTime < new Date()) {
          errors.push('Appointment time cannot be in the past');
        }
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
    let parsedDate: Date | null = null;
    if (dto.appointmentDate !== undefined) {
      const appointmentDate = parseCalendarDate(dto.appointmentDate);
      if (isNaN(appointmentDate.getTime())) {
        errors.push('Invalid appointment date format');
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (appointmentDate < today) {
          errors.push('Appointment date cannot be in the past');
        } else {
          parsedDate = appointmentDate;
        }
      }
    }

    // Validate time if provided
    let timeValid = false;
    if (dto.appointmentTime !== undefined) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(dto.appointmentTime)) {
        errors.push('Invalid appointment time format. Expected HH:MM (e.g., 09:30)');
      } else {
        timeValid = true;
      }
    }

    // Only checkable when both date and time are being updated together — a
    // partial update (time only) doesn't tell us the appointment's existing
    // date here.
    if (parsedDate && timeValid) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsedDate.getTime() === today.getTime()) {
        const [hours, minutes] = dto.appointmentTime!.split(':').map(Number);
        const proposedDateTime = new Date();
        proposedDateTime.setHours(hours, minutes, 0, 0);
        if (proposedDateTime < new Date()) {
          errors.push('Appointment time cannot be in the past');
        }
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
