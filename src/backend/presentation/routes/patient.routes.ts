/**
 * Patient Routes
 * Role-based access control applied per permission matrix
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../middleware/validation';
import { requireRole } from '../middleware/auth';
import {
  createPatientSchema,
  updatePatientSchema,
  patientSearchSchema,
} from '../../application/validators/patient.validator';
import {
  registerPatient,
  searchPatients,
  getPatientById,
  getPatientByPatientNumber,
  updatePatient,
  deletePatient,
} from '../controllers/patient.controller';

const router = Router();

// View patients: ADMIN, DOCTOR, NURSE, LAB_TECH, PHARMACIST, CASHIER, RECEPTIONIST
const CAN_VIEW_PATIENTS = requireRole([
  'SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST', 'CASHIER', 'RECEPTIONIST',
]);

// Create/update patients: ADMIN, DOCTOR, NURSE, RECEPTIONIST
const CAN_MANAGE_PATIENTS = requireRole([
  'SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST',
]);

// Delete patients: ADMIN only
const CAN_DELETE_PATIENTS = requireRole(['SUPER_ADMIN', 'ADMIN']);

router.get(
  '/search',
  CAN_VIEW_PATIENTS,
  validateRequest(patientSearchSchema, 'query'),
  asyncHandler(searchPatients)
);

router.get(
  '/patient-id/:patientId',
  CAN_VIEW_PATIENTS,
  asyncHandler(getPatientByPatientNumber)
);

router.get(
  '/:id',
  CAN_VIEW_PATIENTS,
  asyncHandler(getPatientById)
);

router.post(
  '/',
  CAN_MANAGE_PATIENTS,
  validateRequest(createPatientSchema, 'body'),
  asyncHandler(registerPatient)
);

router.put(
  '/:id',
  CAN_MANAGE_PATIENTS,
  validateRequest(updatePatientSchema, 'body'),
  asyncHandler(updatePatient)
);

router.delete(
  '/:id',
  CAN_DELETE_PATIENTS,
  asyncHandler(deletePatient)
);

export default router;