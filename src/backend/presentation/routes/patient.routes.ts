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
  getPatientClinicalSummary,
  getUnnamedNewborns,
  updatePatient,
  deletePatient,
} from '../controllers/patient.controller';

const router = Router();

// View patients: ADMIN, DOCTOR, NURSE, LAB_TECH, PHARMACIST, CASHIER, RECEPTIONIST
const CAN_VIEW_PATIENTS = requireRole([
  'SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECH', 'PHARMACIST', 'CASHIER', 'RECEPTIONIST',
]);

// Update patients: ADMIN, DOCTOR, NURSE, RECEPTIONIST (correcting/adding to
// an existing record is a reasonable admin task)
const CAN_MANAGE_PATIENTS = requireRole([
  'SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST',
]);

// Register (create) new patients: DOCTOR, NURSE, RECEPTIONIST only — front
// desk/clinical staff, not admin accounts.
const CAN_REGISTER_PATIENTS = requireRole(
  ['DOCTOR', 'NURSE', 'RECEPTIONIST'],
  'Admin accounts cannot register patients. Please ask a receptionist, nurse, or doctor to complete registration.'
);

// Delete patients: ADMIN only
const CAN_DELETE_PATIENTS = requireRole(['SUPER_ADMIN', 'ADMIN']);

// Clinical summary (diagnoses + active prescriptions): clinicians only — this
// is meaningfully more sensitive than the demographic data CAN_VIEW_PATIENTS
// otherwise gates, and its only caller is ConsultationModal.tsx (a
// DOCTOR-only page). CASHIER/RECEPTIONIST/LAB_TECH/PHARMACIST have no
// legitimate need for a patient's diagnosis history or active medications.
const CAN_VIEW_CLINICAL_SUMMARY = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']);

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

// Must come before the /:id catch-all below, or Express would match
// "unnamed-newborns" as an :id param and never reach this handler.
router.get(
  '/unnamed-newborns',
  CAN_VIEW_PATIENTS,
  asyncHandler(getUnnamedNewborns)
);

router.get(
  '/:id/clinical-summary',
  CAN_VIEW_CLINICAL_SUMMARY,
  asyncHandler(getPatientClinicalSummary)
);

router.get(
  '/:id',
  CAN_VIEW_PATIENTS,
  asyncHandler(getPatientById)
);

router.post(
  '/',
  CAN_REGISTER_PATIENTS,
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