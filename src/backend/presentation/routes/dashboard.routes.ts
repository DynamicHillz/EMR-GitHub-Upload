/**
 * Dashboard Routes
 * Defines HTTP routes for dashboard statistics
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import {
  getDashboardStats,
  getRecentPatients,
  getUpcomingAppointments,
} from '../controllers/dashboard.controller';

const router = Router();

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics (counts)
 */
router.get('/stats', asyncHandler(getDashboardStats));

/**
 * GET /api/dashboard/recent-patients
 * Get recent patients (last 5)
 */
router.get('/recent-patients', asyncHandler(getRecentPatients));

/**
 * GET /api/dashboard/upcoming-appointments
 * Get upcoming appointments (next 5)
 */
router.get('/upcoming-appointments', asyncHandler(getUpcomingAppointments));

export default router;
