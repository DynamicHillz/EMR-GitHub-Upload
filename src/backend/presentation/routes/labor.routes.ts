/**
 * Labor Routes
 *
 * Role-gating matches the established inpatient.routes.ts precedent: reads
 * are broader (SUPER_ADMIN/ADMIN/DOCTOR/NURSE), writes are frontline
 * clinical data entry (DOCTOR/NURSE only — not admin-inclusive, same as
 * POST /admissions and POST /admissions/:id/discharge).
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';
import {
  startLabor,
  getLaborRecordByAdmission,
  recordObservation,
  recordDeliveryOutcome,
  getActiveLabors,
  getBillableLaborRecords,
} from '../controllers/labor.controller';

const router = Router();

const CAN_VIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE']);
const CAN_MANAGE = requireRole(['DOCTOR', 'NURSE']);
// Same billing-role set as the other "billable items" endpoints in
// inpatient.routes.ts (getBillableAdmissions/Transfusions/OperationNotes).
const CAN_BILL = requireRole(['SUPER_ADMIN', 'ADMIN', 'CASHIER']);

router.get('/worklist', CAN_VIEW, asyncHandler(getActiveLabors));
router.get('/records/billable', CAN_BILL, asyncHandler(getBillableLaborRecords));
router.get('/admissions/:admissionId', CAN_VIEW, asyncHandler(getLaborRecordByAdmission));
router.post('/admissions/:admissionId/start', CAN_MANAGE, asyncHandler(startLabor));
router.post('/records/:laborRecordId/observations', CAN_MANAGE, asyncHandler(recordObservation));
router.post('/records/:laborRecordId/delivery', CAN_MANAGE, asyncHandler(recordDeliveryOutcome));

export default router;
