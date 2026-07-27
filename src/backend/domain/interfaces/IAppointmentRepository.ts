/**
 * Appointment Repository Interface
 *
 * Defines the contract for appointment data access operations
 * Following the Dependency Inversion Principle (SOLID)
 */

import { Appointment, AppointmentStatus } from '../entities/Appointment';

export interface AppointmentSearchCriteria {
  tenantId: string;
  doctorId?: string;
  patientId?: string;
  date?: Date;
  dateFrom?: Date;
  dateTo?: Date;
  status?: AppointmentStatus;
  skip?: number;
  take?: number;
}

export interface AppointmentCreateData {
  tenantId: string;
  patientId: string;
  doctorId: string;
  appointmentDate: Date;
  appointmentTime: string;
  appointmentType: string;
  reason?: string;
  duration?: number; // defaults to 30 minutes
}

export interface AppointmentUpdateData {
  appointmentDate?: Date;
  appointmentTime?: string;
  appointmentType?: string;
  reason?: string;
  duration?: number;
  status?: AppointmentStatus;
}

export interface OverlappingAppointmentQuery {
  doctorId: string;
  tenantId: string;
  date: Date;
  startTime: string;
  endTime: string;
  excludeId?: string; // Exclude specific appointment (for rescheduling)
}

export interface IAppointmentRepository {
  /**
   * Find an appointment by ID
   */
  findById(id: string, tenantId: string): Promise<Appointment | null>;

  /**
   * Find appointments by patient
   */
  findByPatientId(patientId: string, tenantId: string): Promise<Appointment[]>;

  /**
   * Find appointments by doctor
   */
  findByDoctorId(doctorId: string, tenantId: string): Promise<Appointment[]>;

  /**
   * Search appointments with filters
   */
  search(criteria: AppointmentSearchCriteria): Promise<{ appointments: Appointment[]; total: number }>;

  /**
   * Find overlapping appointments for double-booking prevention
   */
  findOverlapping(query: OverlappingAppointmentQuery): Promise<Appointment[]>;

  /**
   * Get waiting queue for a doctor (checked-in patients)
   */
  getWaitingQueue(doctorId: string, tenantId: string): Promise<Appointment[]>;

  /**
   * Get appointments by date range for calendar view
   */
  findByDateRange(doctorId: string, tenantId: string, startDate: Date, endDate: Date): Promise<Appointment[]>;

  /**
   * Create a new appointment
   */
  create(data: AppointmentCreateData): Promise<Appointment>;

  /**
   * Update an appointment
   */
  update(id: string, tenantId: string, data: AppointmentUpdateData): Promise<Appointment>;

  /**
   * Check in a patient
   */
  checkIn(id: string, tenantId: string): Promise<Appointment>;

  /**
   * Cancel an appointment
   */
  cancel(id: string, tenantId: string, reason: string): Promise<Appointment>;

  /**
   * Delete an appointment (soft delete)
   */
  delete(id: string, tenantId: string, userId?: string): Promise<void>;

  /**
   * Get appointments needing reminders
   */
  findNeedingReminder(hours: number): Promise<Appointment[]>;
  markReminderSent(id: string, hours: number): Promise<void>;
}
