import { Router } from 'express';
import { immunizationController } from '../controllers/immunization.controller';
import { requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { dismissImmunizationDueSchema } from '../../application/validators/worklist.validator';

const router = Router();

const CAN_VIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']);
// Schedule catalog is config (like the lab/medication catalogs elsewhere),
// not a patient record — admin-manageable is appropriate here.
const CAN_MANAGE_SCHEDULE = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']);
// Actually administering a vaccine to a patient is a clinical act.
const CAN_RECORD = requireRole(['DOCTOR', 'NURSE']);

// Schedule Catalog
router.get('/schedule', CAN_VIEW, immunizationController.getSchedule);
router.post('/schedule', CAN_MANAGE_SCHEDULE, immunizationController.createScheduleItem);

// Overdue worklist
router.get('/overdue', CAN_VIEW, immunizationController.getOverdueImmunizations);
router.post(
  '/due/:patientId/:scheduleId/dismiss',
  CAN_RECORD,
  validateRequest(dismissImmunizationDueSchema, 'body'),
  immunizationController.dismissDueImmunization
);

// Patient Immunizations
router.get('/patient/:patientId', CAN_VIEW, immunizationController.getPatientImmunizations);
router.post('/patient/:patientId', CAN_RECORD, immunizationController.recordImmunization);

export default router;
