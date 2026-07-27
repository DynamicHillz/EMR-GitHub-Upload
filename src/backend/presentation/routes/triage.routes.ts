import { Router } from 'express';
import { TriageController } from '../controllers/triage.controller';
import { requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { createTriageSchema, updateTriageSchema } from '../../application/validators/triage.validator';

const router = Router();
const triageController = new TriageController();

// Both nurses and doctors can view the queue and triage records
router.get('/queue', requireRole(['NURSE', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN']), triageController.getTriageQueue);
router.get('/patient/:patientId', requireRole(['NURSE', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN']), triageController.getPatientTriageHistory);
router.get('/:id', requireRole(['NURSE', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN']), triageController.getTriageRecord);

// Create and update triage records: NURSE only
router.post('/', requireRole(['NURSE']), validateRequest(createTriageSchema, 'body'), triageController.createTriageRecord);
router.put('/:id', requireRole(['NURSE']), validateRequest(updateTriageSchema, 'body'), triageController.updateTriageRecord);

// Mark as seen by doctor: DOCTOR only
router.post('/:id/seen', requireRole(['DOCTOR']), triageController.markAsSeen);

export default router;
