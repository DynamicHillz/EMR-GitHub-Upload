/**
 * Consultation Routes
 * Role-based access control applied per permission matrix
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../middleware/validation';
import { requireRole } from '../middleware/auth';
import {
  createConsultationSchema,
  updateConsultationSchema,
} from '../../application/validators/consultation.validator';
import {
  createConsultation,
  updateConsultation,
  finalizeConsultation,
  getConsultationById,
  getPatientConsultations,
  deleteConsultation,
  createPrescription,
  orderLabTest,
} from '../controllers/consultation.controller';

const router = Router();

// View consultations: ADMIN, DOCTOR, NURSE
const CAN_VIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']);

// Create/update/finalize consultations: ADMIN, DOCTOR only
const CAN_MANAGE = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR']);

// Delete: ADMIN only
const ADMIN_ONLY = requireRole(['SUPER_ADMIN', 'ADMIN']);

router.get('/patient/:patientId', CAN_VIEW, asyncHandler(getPatientConsultations));
router.get('/:id', CAN_VIEW, asyncHandler(getConsultationById));

router.post(
  '/',
  CAN_MANAGE,
  validateRequest(createConsultationSchema, 'body'),
  asyncHandler(createConsultation)
);

router.put(
  '/:id',
  CAN_MANAGE,
  validateRequest(updateConsultationSchema, 'body'),
  asyncHandler(updateConsultation)
);

router.post('/:id/finalize', CAN_MANAGE, asyncHandler(finalizeConsultation));
router.delete('/:id', ADMIN_ONLY, asyncHandler(deleteConsultation));

// Prescriptions from consultation: DOCTOR only
router.post(
  '/:id/prescriptions',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR']),
  asyncHandler(createPrescription)
);

// Lab test ordering from consultation: ADMIN, DOCTOR
router.post(
  '/:id/lab-tests',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR']),
  asyncHandler(orderLabTest)
);

export default router;