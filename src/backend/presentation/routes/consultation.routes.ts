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

// View consultations: ADMIN, DOCTOR, NURSE, CASHIER
const CAN_VIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'CASHIER']);

// Create/update/finalize consultations: DOCTOR only
const CAN_MANAGE = requireRole(['DOCTOR']);

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
  requireRole(['DOCTOR']),
  asyncHandler(createPrescription)
);

// Lab test ordering from consultation: DOCTOR only
router.post(
  '/:id/lab-tests',
  requireRole(['DOCTOR']),
  asyncHandler(orderLabTest)
);

export default router;