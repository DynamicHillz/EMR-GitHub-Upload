/**
 * Lab Test Routes
 *
 * API endpoints for laboratory management
 */

import { Router } from 'express';
import {
  getLabTestQueue,
  getLabTestById,
  updateLabTestStatus,
  submitLabResults,
  reviewLabResults,
  updateSpecimenDetails,
} from '../controllers/lab-test.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * GET /api/lab-tests
 * Get lab test queue
 * Query params: status, urgency, limit
 * REQ-LAB-1: Display pending lab tests sorted by urgency
 */
router.get('/', getLabTestQueue);

/**
 * GET /api/lab-tests/:id
 * Get lab test by ID
 */
router.get('/:id', getLabTestById);

/**
 * PUT /api/lab-tests/:id/status
 * Update lab test status
 * REQ-LAB-2: Allow lab technicians to update test status
 */
router.put('/:id/status', updateLabTestStatus);

/**
 * PUT /api/lab-tests/:id/results
 * Submit lab test results
 * REQ-LAB-3: Structured result entry with reference ranges
 * REQ-LAB-4: Auto-flag abnormal results
 */
router.put('/:id/results', submitLabResults);

/**
 * POST /api/lab-tests/:id/review
 * Review lab test results
 * REQ-LAB-5: Require doctor review and approval
 */
router.post('/:id/review', reviewLabResults);

/**
 * PUT /api/lab-tests/:id/specimen
 * Update specimen details
 * REQ-LAB-7: Track specimen collection, quality, and rejection
 */
router.put('/:id/specimen', updateSpecimenDetails);

export default router;
