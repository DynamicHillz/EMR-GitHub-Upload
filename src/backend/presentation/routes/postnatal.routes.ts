/**
 * Postnatal Routes
 *
 * Role-gating mirrors labor.routes.ts: reads are broader
 * (SUPER_ADMIN/ADMIN/DOCTOR/NURSE), writes are frontline clinical data entry
 * (DOCTOR/NURSE only).
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { recordPostnatalVisitSchema } from '../../application/validators/postnatal.validator';
import { dismissPostnatalDueSchema } from '../../application/validators/worklist.validator';
import {
  recordPostnatalVisit,
  getPostnatalVisitsByPatient,
  getPostnatalWorklist,
  getBillablePostnatalVisits,
  dismissDuePostnatal,
} from '../controllers/postnatal.controller';

const router = Router();

const CAN_VIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']);
const CAN_MANAGE = requireRole(['DOCTOR', 'NURSE']);
// Same billing-role set as labor.routes.ts's own billable-records endpoint.
const CAN_BILL = requireRole(['SUPER_ADMIN', 'ADMIN', 'CASHIER']);

router.get('/worklist', CAN_VIEW, asyncHandler(getPostnatalWorklist));
router.get('/records/billable', CAN_BILL, asyncHandler(getBillablePostnatalVisits));
router.get('/patient/:patientId', CAN_VIEW, asyncHandler(getPostnatalVisitsByPatient));
router.post(
  '/patient/:patientId',
  CAN_MANAGE,
  validateRequest(recordPostnatalVisitSchema, 'body'),
  asyncHandler(recordPostnatalVisit)
);
router.post(
  '/due/:patientId/dismiss',
  CAN_MANAGE,
  validateRequest(dismissPostnatalDueSchema, 'body'),
  asyncHandler(dismissDuePostnatal)
);

export default router;
