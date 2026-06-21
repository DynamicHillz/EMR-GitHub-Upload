/**
 * Billing Configuration Routes
 *
 * Routes for managing tenant billing configuration
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import {
  getBillingConfig,
  updateBillingConfig
} from '../controllers/billing-config.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get billing configuration
router.get('/', asyncHandler(getBillingConfig));

// Update billing configuration (Admin only)
router.put('/', asyncHandler(updateBillingConfig));

export default router;
