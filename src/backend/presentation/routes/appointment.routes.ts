/**
 * Appointment Routes
 * Role-based access control applied per permission matrix
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';
import {
  bookAppointment,
  getAppointments,
  getAppointmentById,
  checkInAppointment,
  cancelAppointment,
  getWaitingQueue,
  updateAppointment,
  deleteAppointment,
} from '../controllers/appointment.controller';

const router = Router();

// View appointments: ADMIN, DOCTOR, NURSE, RECEPTIONIST
const CAN_VIEW_APPOINTMENTS = requireRole([
  'SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST',
]);

// Create/manage appointments: ADMIN, DOCTOR, NURSE, RECEPTIONIST
const CAN_MANAGE_APPOINTMENTS = requireRole([
  'SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST',
]);

router.get('/', CAN_VIEW_APPOINTMENTS, asyncHandler(getAppointments));
router.get('/doctor/:doctorId/waiting-queue', CAN_VIEW_APPOINTMENTS, asyncHandler(getWaitingQueue));
router.get('/:id', CAN_VIEW_APPOINTMENTS, asyncHandler(getAppointmentById));
router.post('/', CAN_MANAGE_APPOINTMENTS, asyncHandler(bookAppointment));
router.post('/:id/check-in', CAN_MANAGE_APPOINTMENTS, asyncHandler(checkInAppointment));
router.post('/:id/cancel', CAN_MANAGE_APPOINTMENTS, asyncHandler(cancelAppointment));
router.put('/:id', CAN_MANAGE_APPOINTMENTS, asyncHandler(updateAppointment));
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), asyncHandler(deleteAppointment));

export default router;