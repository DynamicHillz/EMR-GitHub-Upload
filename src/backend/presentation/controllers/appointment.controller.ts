/**
 * Appointment Controller
 *
 * HTTP layer for appointment operations
 * Handles request/response transformation and error handling
 */

import { Request, Response } from 'express';
import { BookAppointmentUseCase } from '../../application/use-cases/appointment/book-appointment.use-case';
import { GetAppointmentsUseCase } from '../../application/use-cases/appointment/get-appointments.use-case';
import { CheckInAppointmentUseCase } from '../../application/use-cases/appointment/check-in-appointment.use-case';
import { CancelAppointmentUseCase } from '../../application/use-cases/appointment/cancel-appointment.use-case';
import { GetWaitingQueueUseCase } from '../../application/use-cases/appointment/get-waiting-queue.use-case';
import { AppointmentRepository } from '../../infrastructure/database/repositories/appointment.repository';
import { PatientRepository } from '../../infrastructure/database/repositories/patient.repository';
import { prisma } from '../../infrastructure/database/prisma.client';
import { logger } from '../../config/logger';

// Initialize dependencies
const appointmentRepository = new AppointmentRepository(prisma);
const patientRepository = new PatientRepository(prisma);

// Initialize use cases
const bookAppointmentUseCase = new BookAppointmentUseCase(appointmentRepository, patientRepository);
const getAppointmentsUseCase = new GetAppointmentsUseCase(appointmentRepository);
const checkInAppointmentUseCase = new CheckInAppointmentUseCase(appointmentRepository);
const cancelAppointmentUseCase = new CancelAppointmentUseCase(appointmentRepository);
const getWaitingQueueUseCase = new GetWaitingQueueUseCase(appointmentRepository);

/**
 * POST /api/appointments
 */
export const bookAppointment = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized: No tenant ID found' });

    const result = await bookAppointmentUseCase.execute(req.body, tenantId);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 :
                        result.error?.includes('conflicts') || result.error?.includes('unavailable') ? 409 : 400;
      return res.status(statusCode).json(result);
    }

    return res.status(201).json(result);
  } catch (error: any) {
    logger.error('Error booking appointment:', error);
    return res.status(500).json({ success: false, message: 'Failed to book appointment', error: error.message });
  }
};

/**
 * GET /api/appointments
 */
export const getAppointments = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized: No tenant ID found' });

    const dto = {
      doctorId: req.query.doctorId as string,
      patientId: req.query.patientId as string,
      date: req.query.date as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      status: req.query.status as any,
      skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
      take: req.query.take ? parseInt(req.query.take as string) : undefined,
    };

    const result = await getAppointmentsUseCase.execute(dto, tenantId);

    if (!result.success) return res.status(400).json(result);

    // Enrich appointments with patient and doctor names
    const appointments = result.appointments ?? [];
    const patientIds = [...new Set(appointments.map((a: any) => a.patientId))];
    const doctorIds  = [...new Set(appointments.map((a: any) => a.doctorId))];

    const [patients, doctors] = await Promise.all([
      prisma.patient.findMany({
        where: { id: { in: patientIds as string[] }, tenantId },
        select: { id: true, firstName: true, lastName: true, patientId: true },
      }),
      prisma.user.findMany({
        where: { id: { in: doctorIds as string[] }, tenantId },
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);

    const patientMap = new Map(patients.map(p => [p.id, p]));
    const doctorMap  = new Map(doctors.map(d => [d.id, d]));

    const enriched = appointments.map((apt: any) => {
      const patient = patientMap.get(apt.patientId);
      const doctor  = doctorMap.get(apt.doctorId);
      return {
        ...apt,
        patientName:   patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient',
        patientNumber: patient?.patientId ?? '',
        doctorName:    doctor  ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Unknown Doctor',
      };
    });

    return res.status(200).json({ ...result, appointments: enriched });
  } catch (error: any) {
    logger.error('Error getting appointments:', error);
    return res.status(500).json({ success: false, message: 'Failed to get appointments', error: error.message });
  }
};

/**
 * GET /api/appointments/:id
 */
export const getAppointmentById = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized: No tenant ID found' });

    const appointment = await appointmentRepository.findById(req.params.id, tenantId);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    return res.status(200).json({ success: true, message: 'Appointment retrieved successfully', appointment });
  } catch (error: any) {
    logger.error('Error getting appointment:', error);
    return res.status(500).json({ success: false, message: 'Failed to get appointment', error: error.message });
  }
};

/**
 * POST /api/appointments/:id/check-in
 */
export const checkInAppointment = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized: No tenant ID found' });

    const result = await checkInAppointmentUseCase.execute(req.params.id, tenantId);
    if (!result.success) {
      return res.status(result.error?.includes('not found') ? 404 : 400).json(result);
    }
    return res.status(200).json(result);
  } catch (error: any) {
    logger.error('Error checking in appointment:', error);
    return res.status(500).json({ success: false, message: 'Failed to check in', error: error.message });
  }
};

/**
 * POST /api/appointments/:id/cancel
 */
export const cancelAppointment = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized: No tenant ID found' });

    const result = await cancelAppointmentUseCase.execute(req.params.id, req.body.reason, tenantId);
    if (!result.success) {
      return res.status(result.error?.includes('not found') ? 404 : 400).json(result);
    }
    return res.status(200).json(result);
  } catch (error: any) {
    logger.error('Error cancelling appointment:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel appointment', error: error.message });
  }
};

/**
 * GET /api/appointments/doctor/:doctorId/waiting-queue
 */
export const getWaitingQueue = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized: No tenant ID found' });

    const result = await getWaitingQueueUseCase.execute(req.params.doctorId, tenantId);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error: any) {
    logger.error('Error getting waiting queue:', error);
    return res.status(500).json({ success: false, message: 'Failed to get waiting queue', error: error.message });
  }
};

/**
 * PUT /api/appointments/:id
 */
export const updateAppointment = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized: No tenant ID found' });

    const { id } = req.params;

    if (req.body.appointmentDate || req.body.appointmentTime) {
      const appointment = await appointmentRepository.findById(id, tenantId);
      if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

      const appointmentDate = req.body.appointmentDate ? new Date(req.body.appointmentDate) : appointment.appointmentDate;
      const appointmentTime = req.body.appointmentTime || appointment.appointmentTime;
      const duration = req.body.duration || appointment.duration;

      const [hours, minutes] = appointmentTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + duration;
      const endTime = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;

      const overlapping = await appointmentRepository.findOverlapping({
        doctorId: appointment.doctorId,
        tenantId,
        date: appointmentDate,
        startTime: appointmentTime,
        endTime,
        excludeId: id,
      });

      if (overlapping.length > 0) {
        return res.status(409).json({ success: false, message: 'Time slot unavailable', error: 'This time slot conflicts with an existing appointment' });
      }
    }

    const updatedAppointment = await appointmentRepository.update(id, tenantId, req.body);
    return res.status(200).json({ success: true, message: 'Appointment updated successfully', appointment: updatedAppointment });
  } catch (error: any) {
    logger.error('Error updating appointment:', error);
    return res.status(500).json({ success: false, message: 'Failed to update appointment', error: error.message });
  }
};

/**
 * DELETE /api/appointments/:id
 */
export const deleteAppointment = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized: No tenant ID found' });

    await appointmentRepository.delete(req.params.id, tenantId);
    return res.status(200).json({ success: true, message: 'Appointment deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting appointment:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete appointment', error: error.message });
  }
};