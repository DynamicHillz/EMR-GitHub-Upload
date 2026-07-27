/**
 * Appointment Repository Implementation
 *
 * Implements the IAppointmentRepository interface
 * Handles all database operations for appointments using Prisma
 *
 * Features:
 * - Multi-tenant filtering
 * - Double-booking prevention
 * - Waiting queue management
 * - Calendar date range queries
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  IAppointmentRepository,
  AppointmentCreateData,
  AppointmentUpdateData,
  AppointmentSearchCriteria,
  OverlappingAppointmentQuery,
} from '../../../domain/interfaces/IAppointmentRepository';
import { Appointment, AppointmentStatus } from '../../../domain/entities/Appointment';
import { ConflictError } from '../../../shared/errors/AppError';

export class AppointmentRepository implements IAppointmentRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find an appointment by ID
   */
  async findById(id: string, tenantId: string): Promise<Appointment | null> {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id,
        tenantId,
        isDeleted: false,
      },
    });

    return appointment ? this.mapToEntity(appointment) : null;
  }

  /**
   * Find appointments by patient
   */
  async findByPatientId(patientId: string, tenantId: string): Promise<Appointment[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        patientId,
        tenantId,
        isDeleted: false,
      },
      orderBy: {
        appointmentDate: 'desc',
      },
    });

    return appointments.map(a => this.mapToEntity(a));
  }

  /**
   * Find appointments by doctor
   */
  async findByDoctorId(doctorId: string, tenantId: string): Promise<Appointment[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        tenantId,
        isDeleted: false,
      },
      orderBy: {
        appointmentDate: 'desc',
      },
    });

    return appointments.map(a => this.mapToEntity(a));
  }

  /**
   * Search appointments with filters
   */
  async search(criteria: AppointmentSearchCriteria): Promise<{ appointments: Appointment[]; total: number }> {
    const { tenantId, doctorId, patientId, date, dateFrom, dateTo, status, skip = 0, take = 50 } = criteria;

    const whereClause: Prisma.AppointmentWhereInput = {
      tenantId,
      isDeleted: false,
    };

    if (doctorId) {
      whereClause.doctorId = doctorId;
    }

    if (patientId) {
      whereClause.patientId = patientId;
    }

    if (date) {
      // Search for specific date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      whereClause.appointmentDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else if (dateFrom && dateTo) {
      // Search for date range
      whereClause.appointmentDate = {
        gte: dateFrom,
        lte: dateTo,
      };
    } else if (dateFrom) {
      whereClause.appointmentDate = {
        gte: dateFrom,
      };
    } else if (dateTo) {
      whereClause.appointmentDate = {
        lte: dateTo,
      };
    }

    if (status) {
      whereClause.status = status;
    }

    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: [
          { appointmentDate: 'asc' },
          { appointmentTime: 'asc' },
        ],
      }),
      this.prisma.appointment.count({ where: whereClause }),
    ]);

    return {
      appointments: appointments.map(a => this.mapToEntity(a)),
      total,
    };
  }

  /**
   * Find overlapping appointments for double-booking prevention
   */
  async findOverlapping(query: OverlappingAppointmentQuery): Promise<Appointment[]> {
    const { doctorId, tenantId, date, startTime, endTime, excludeId } = query;

    // Set date bounds
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const whereClause: Prisma.AppointmentWhereInput = {
      doctorId,
      tenantId,
      isDeleted: false,
      appointmentDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: {
        notIn: ['CANCELLED', 'NO_SHOW'],
      },
    };

    if (excludeId) {
      whereClause.id = {
        not: excludeId,
      };
    }

    const appointments = await this.prisma.appointment.findMany({
      where: whereClause,
    });

    // Filter for actual time overlaps
    const overlapping = appointments.filter(apt => {
      const aptEndTime = this.calculateEndTime(apt.appointmentTime, apt.duration);
      return this.timesOverlap(apt.appointmentTime, aptEndTime, startTime, endTime);
    });

    return overlapping.map(a => this.mapToEntity(a));
  }

  /**
   * Get waiting queue for a doctor (checked-in patients)
   */
  async getWaitingQueue(doctorId: string, tenantId: string): Promise<Appointment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        tenantId,
        isDeleted: false,
        status: 'CHECKED_IN',
        appointmentDate: {
          gte: today,
          lte: endOfDay,
        },
      },
      orderBy: {
        checkedInAt: 'asc',
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return appointments.map(a => this.mapToEntity(a));
  }

  /**
   * Get appointments by date range for calendar view
   */
  async findByDateRange(doctorId: string, tenantId: string, startDate: Date, endDate: Date): Promise<Appointment[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        tenantId,
        isDeleted: false,
        appointmentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [
        { appointmentDate: 'asc' },
        { appointmentTime: 'asc' },
      ],
    });

    return appointments.map(a => this.mapToEntity(a));
  }

  /**
   * Create a new appointment
   */
  async create(data: AppointmentCreateData): Promise<Appointment> {
    const appointment = await this.prisma.appointment.create({
      data: {
        tenantId: data.tenantId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        appointmentDate: data.appointmentDate,
        appointmentTime: data.appointmentTime,
        appointmentType: data.appointmentType,
        reason: data.reason,
        duration: data.duration || 30, // Default 30 minutes
        status: 'SCHEDULED',
        reminderSent24h: false,
        reminderSent2h: false,
      },
    });

    return this.mapToEntity(appointment);
  }

  /**
   * Update an appointment
   */
  async update(id: string, tenantId: string, data: AppointmentUpdateData, expectedVersion?: number): Promise<Appointment> {
    // Verify appointment belongs to tenant
    await this.findById(id, tenantId);

    if (expectedVersion !== undefined) {
      const versionCheck = await this.prisma.appointment.updateMany({
        where: { id, tenantId, version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (versionCheck.count === 0) {
        throw new ConflictError('This appointment was changed by someone else. Please reload and try again.');
      }
    } else {
      await this.prisma.appointment.update({ where: { id }, data: { version: { increment: 1 } } });
    }

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        ...(data.appointmentDate && { appointmentDate: data.appointmentDate }),
        ...(data.appointmentTime && { appointmentTime: data.appointmentTime }),
        ...(data.appointmentType && { appointmentType: data.appointmentType }),
        ...(data.reason !== undefined && { reason: data.reason }),
        ...(data.duration && { duration: data.duration }),
        ...(data.status && { status: data.status }),
        updatedAt: new Date(),
      },
    });

    return this.mapToEntity(appointment);
  }

  /**
   * Check in a patient
   */
  async checkIn(id: string, tenantId: string): Promise<Appointment> {
    // Verify appointment belongs to tenant
    await this.findById(id, tenantId);

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CHECKED_IN',
        checkedInAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return this.mapToEntity(appointment);
  }

  /**
   * Cancel an appointment
   */
  async cancel(id: string, tenantId: string, reason: string): Promise<Appointment> {
    // Verify appointment belongs to tenant
    await this.findById(id, tenantId);

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
        updatedAt: new Date(),
      },
    });

    return this.mapToEntity(appointment);
  }

  /**
   * Delete an appointment (soft delete - set to cancelled)
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<void> {
    // Verify appointment belongs to tenant
    await this.findById(id, tenantId);

    // Soft delete
    await this.prisma.appointment.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'Deleted by Admin',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get appointments needing reminders
   */
  async findNeedingReminder(hours: number): Promise<Appointment[]> {
    const now = new Date();
    const targetTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const reminderField = hours === 24 ? 'reminderSent24h' : 'reminderSent2h';

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: 'SCHEDULED',
        [reminderField]: false,
        appointmentDate: {
          gte: now,
          lte: targetTime,
        },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    return appointments.map(a => this.mapToEntity(a));
  }

  /**
   * Mark the 24h or 2h reminder as sent for an appointment
   */
  async markReminderSent(id: string, hours: number): Promise<void> {
    const reminderField = hours === 24 ? 'reminderSent24h' : 'reminderSent2h';
    await this.prisma.appointment.update({
      where: { id },
      data: { [reminderField]: true },
    });
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

  /**
   * Helper: Check if two time ranges overlap
   */
  private timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const start1Minutes = this.timeToMinutes(start1);
    const end1Minutes = this.timeToMinutes(end1);
    const start2Minutes = this.timeToMinutes(start2);
    const end2Minutes = this.timeToMinutes(end2);

    return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
  }

  /**
   * Helper: Convert time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Map Prisma appointment to domain entity
   */
  private mapToEntity(appointment: any): Appointment {
    return {
      id: appointment.id,
      tenantId: appointment.tenantId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      appointmentType: appointment.appointmentType,
      reason: appointment.reason ?? undefined,
      duration: appointment.duration,
      status: appointment.status as AppointmentStatus,
      checkedInAt: appointment.checkedInAt ?? undefined,
      completedAt: appointment.completedAt ?? undefined,
      cancelledAt: appointment.cancelledAt ?? undefined,
      cancellationReason: appointment.cancellationReason ?? undefined,
      reminderSent24h: appointment.reminderSent24h,
      reminderSent2h: appointment.reminderSent2h,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      patient: appointment.patient,
    };
  }
}

