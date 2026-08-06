import { Router } from 'express';
import { ancController } from '../controllers/anc.controller';
import { requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  createPregnancySchema,
  updatePregnancyStatusSchema,
  createAncVisitSchema,
} from '../../application/validators/anc.validator';

const router = Router();

// View-only for admin oversight/billing context; creating/updating maternal
// health records is a clinical act, restricted to DOCTOR/NURSE below.
const CAN_VIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']);
const CAN_MANAGE = requireRole(['DOCTOR', 'NURSE']);

// ANC Pregnancies
router.get('/active', CAN_VIEW, ancController.getActivePregnancies);
router.get('/patient/:patientId/pregnancies', CAN_VIEW, ancController.getPregnanciesByPatient);
router.post('/patient/:patientId/pregnancies', CAN_MANAGE, validateRequest(createPregnancySchema, 'body'), ancController.createPregnancy);
router.put('/pregnancies/:pregnancyId', CAN_MANAGE, validateRequest(updatePregnancyStatusSchema, 'body'), ancController.updatePregnancyStatus);

// ANC Visits
router.get('/pregnancies/:pregnancyId/visits', CAN_VIEW, ancController.getVisitsByPregnancy);
router.post('/pregnancies/:pregnancyId/visits', CAN_MANAGE, validateRequest(createAncVisitSchema, 'body'), ancController.createVisit);

export default router;
