/**
 * Appointment Domain Entity
 *
 * Represents a scheduled appointment between a patient and doctor
 * Contains business logic for appointment management
 */

export interface Appointment {
  id: string;
  tenantId: string;
  patientId: string;
  doctorId: string;
  
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };

  // Appointment Details
  appointmentDate: Date;
  appointmentTime: string;
  appointmentType: string;
  reason?: string;
  duration: number; // in minutes

  // Status
  status: AppointmentStatus;
  checkedInAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;

  // Reminders
  reminderSent24h: boolean;
  reminderSent2h: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export class AppointmentEntity implements Appointment {
  constructor(
    public id: string,
    public tenantId: string,
    public patientId: string,
    public doctorId: string,
    public appointmentDate: Date,
    public appointmentTime: string,
    public appointmentType: string,
    public duration: number,
    public status: AppointmentStatus,
    public reminderSent24h: boolean,
    public reminderSent2h: boolean,
    public createdAt: Date,
    public updatedAt: Date,
    public patient?: { id: string; firstName: string; lastName: string },
    public reason?: string,
    public checkedInAt?: Date,
    public completedAt?: Date,
    public cancelledAt?: Date,
    public cancellationReason?: string
  ) {}

  /**
   * Check if appointment is active (not cancelled or completed)
   */
  get isActive(): boolean {
    return this.status !== AppointmentStatus.CANCELLED &&
           this.status !== AppointmentStatus.COMPLETED &&
           this.status !== AppointmentStatus.NO_SHOW
  }

  /**
   * Check if appointment can be checked in
   */
  canCheckIn(): boolean {
    return this.status === AppointmentStatus.SCHEDULED
  }

  /**
   * Check if appointment can be rescheduled
   */
  canReschedule(): boolean {
    return this.status === AppointmentStatus.SCHEDULED
  }

  /**
   * Check if appointment can be cancelled
   */
  canCancel(): boolean {
    return this.status === AppointmentStatus.SCHEDULED ||
           this.status === AppointmentStatus.CHECKED_IN
  }

  /**
   * Calculate appointment end time
   */
  getEndTime(): string {
    const [hours, minutes] = this.appointmentTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + this.duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  }

  /**
   * Check if appointment time overlaps with another appointment
   */
  overlapsWith(other: Appointment): boolean {
    // Must be same doctor
    if (this.doctorId !== other.doctorId) {
      return false;
    }

    // Must be same date
    if (this.appointmentDate.toDateString() !== other.appointmentDate.toDateString()) {
      return false;
    }

    // Ignore cancelled or no-show appointments
    if (other.status === AppointmentStatus.CANCELLED || other.status === AppointmentStatus.NO_SHOW) {
      return false;
    }

    const thisStart = this.timeToMinutes(this.appointmentTime);
    const thisEnd = thisStart + this.duration;
    const otherStart = this.timeToMinutes(other.appointmentTime);
    const otherEnd = otherStart + other.duration;

    return thisStart < otherEnd && thisEnd > otherStart;
  }

  /**
   * Convert time string (HH:MM) to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Check if appointment is in the past
   */
  get isPast(): boolean {
    const now = new Date();
    const appointmentDateTime = new Date(this.appointmentDate);
    const [hours, minutes] = this.appointmentTime.split(':').map(Number);
    appointmentDateTime.setHours(hours, minutes);
    return appointmentDateTime < now;
  }

  /**
   * Check if reminder should be sent (24h before)
   */
  shouldSend24hReminder(): boolean {
    if (this.reminderSent24h) return false;
    if (this.status !== AppointmentStatus.SCHEDULED) return false;

    const now = new Date();
    const appointmentDateTime = new Date(this.appointmentDate);
    const [hours, minutes] = this.appointmentTime.split(':').map(Number);
    appointmentDateTime.setHours(hours, minutes);

    const hoursDiff = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 24 && hoursDiff > 0;
  }

  /**
   * Check if reminder should be sent (2h before)
   */
  shouldSend2hReminder(): boolean {
    if (this.reminderSent2h) return false;
    if (this.status !== AppointmentStatus.SCHEDULED) return false;

    const now = new Date();
    const appointmentDateTime = new Date(this.appointmentDate);
    const [hours, minutes] = this.appointmentTime.split(':').map(Number);
    appointmentDateTime.setHours(hours, minutes);

    const hoursDiff = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 2 && hoursDiff > 0;
  }
}
