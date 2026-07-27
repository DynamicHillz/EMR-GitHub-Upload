/**
 * Tenant Routes
 *
 * SUPER_ADMIN-only clinic (tenant) management.
 */

import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { createTenant, listTenants, updateTenantStatus } from '../controllers/tenant.controller';

const router = Router();

// Creating/listing/suspending clinics is a platform-operator action, not a
// per-clinic-admin one — SUPER_ADMIN only, throughout.
router.use(requireRole(['SUPER_ADMIN']));

router.get('/', asyncHandler(listTenants));
router.post('/', asyncHandler(createTenant));
router.patch('/:id/status', asyncHandler(updateTenantStatus));

export default router;
