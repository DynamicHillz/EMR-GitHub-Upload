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
  getLabDictionary,
  createLabDictionaryItem,
  updateLabDictionaryItem,
} from '../controllers/lab-test.controller';

const router = Router();

// View lab tests: ADMIN, DOCTOR, NURSE, LAB_TECH, CASHIER
const CAN_VIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECH', 'CASHIER']);

// Order lab tests: DOCTOR only
const CAN_ORDER = requireRole(['DOCTOR']);

// Process samples and enter results: LAB_TECH only
const CAN_PROCESS = requireRole(['LAB_TECH']);

// Review and verify final results: DOCTOR only
const CAN_REVIEW = requireRole(['DOCTOR']);

// Manage catalog: ADMIN, LAB_TECH
const CAN_MANAGE_CATALOG = requireRole(['SUPER_ADMIN', 'ADMIN', 'LAB_TECH']);

router.get('/dictionary', CAN_VIEW, asyncHandler(getLabDictionary));
router.post('/dictionary', CAN_MANAGE_CATALOG, asyncHandler(createLabDictionaryItem));
router.put('/dictionary/:id', CAN_MANAGE_CATALOG, asyncHandler(updateLabDictionaryItem));
router.get('/tests', CAN_VIEW, asyncHandler(getLabTestQueue));
router.get('/tests/:id', CAN_VIEW, asyncHandler(getLabTestById));
router.post('/tests', CAN_ORDER, asyncHandler(createLabTest));
router.put('/tests/:id/status', CAN_PROCESS, asyncHandler(updateLabTestStatus));
router.put('/tests/:id/results', CAN_PROCESS, asyncHandler(submitLabResults));
router.put('/tests/:id/specimen', CAN_PROCESS, asyncHandler(updateSpecimenDetails));
router.post('/tests/:id/review', CAN_REVIEW, asyncHandler(reviewLabResults));

export default router;