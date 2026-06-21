/**
 * Lab Test Routes
 * Role-based access control applied per permission matrix
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';
import {
  createLabTest,
  getLabTestQueue,
  getLabTestById,
  updateLabTestStatus,
  submitLabResults,
  reviewLabResults,
  updateSpecimenDetails,
} from '../controllers/lab-test.controller';

const router = Router();

// View lab tests: ADMIN, DOCTOR, NURSE, LAB_TECH
const CAN_VIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECH']);

// Order lab tests: ADMIN, DOCTOR
const CAN_ORDER = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR']);

// Process lab tests (status, specimen, results): ADMIN, LAB_TECH
const CAN_PROCESS = requireRole(['SUPER_ADMIN', 'ADMIN', 'LAB_TECH']);

// Review results: ADMIN, DOCTOR
const CAN_REVIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR']);

router.get('/tests', CAN_VIEW, asyncHandler(getLabTestQueue));
router.get('/tests/:id', CAN_VIEW, asyncHandler(getLabTestById));
router.post('/tests', CAN_ORDER, asyncHandler(createLabTest));
router.put('/tests/:id/status', CAN_PROCESS, asyncHandler(updateLabTestStatus));
router.put('/tests/:id/results', CAN_PROCESS, asyncHandler(submitLabResults));
router.put('/tests/:id/specimen', CAN_PROCESS, asyncHandler(updateSpecimenDetails));
router.post('/tests/:id/review', CAN_REVIEW, asyncHandler(reviewLabResults));

export default router;