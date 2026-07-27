/**
 * Fraud Prevention Settings Routes
 */

import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { getFraudPreventionSettings, updateFraudPreventionSettings } from '../controllers/fraud-prevention.controller';

const router = Router();

router.use(requireRole(['SUPER_ADMIN', 'ADMIN']));

router.get('/', asyncHandler(getFraudPreventionSettings));
router.put('/', asyncHandler(updateFraudPreventionSettings));

export default router;
