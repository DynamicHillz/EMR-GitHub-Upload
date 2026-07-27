/**
 * Billing Configuration Routes
 *
 * Routes for managing tenant billing configuration
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import {
  getBillingConfig,
  updateBillingConfig
} from '../controllers/billing-config.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get billing configuration (Admin, Cashier)
router.get('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'CASHIER']), asyncHandler(getBillingConfig));

// Update billing configuration (Admin only)
router.put('/', requireRole(['SUPER_ADMIN', 'ADMIN']), asyncHandler(updateBillingConfig));

export default router;
