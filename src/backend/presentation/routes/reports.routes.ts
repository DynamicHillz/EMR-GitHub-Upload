/**
 * Reports Routes
 *
 * Reporting & Analytics — admin-only (cross-department financial, clinical,
 * and pharmacy data).
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';
import {
  getPatientVolumeReport,
  getRevenueReport,
  getDiagnosisTrendsReport,
  getStockTurnoverReport,
  getNoShowReport,
  getNhmisMonthlyReturnReport,
} from '../controllers/reports.controller';

const router = Router();

const ADMIN_ONLY = requireRole(['SUPER_ADMIN', 'ADMIN']);

router.get('/patient-volume', ADMIN_ONLY, asyncHandler(getPatientVolumeReport));
router.get('/revenue', ADMIN_ONLY, asyncHandler(getRevenueReport));
router.get('/diagnoses', ADMIN_ONLY, asyncHandler(getDiagnosisTrendsReport));
router.get('/stock-turnover', ADMIN_ONLY, asyncHandler(getStockTurnoverReport));
router.get('/no-shows', ADMIN_ONLY, asyncHandler(getNoShowReport));
router.get('/nhmis-monthly-return', ADMIN_ONLY, asyncHandler(getNhmisMonthlyReturnReport));

export default router;
