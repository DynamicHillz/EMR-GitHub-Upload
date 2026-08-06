/**
 * License Routes
 *
 * Status is readable by any authenticated role — informational, not
 * sensitive; MainLayout.tsx decides who actually sees a banner about it.
 * Updating (renewing) the license is SUPER_ADMIN-only.
 */

import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { getLicenseStatus, updateLicense } from '../controllers/license.controller';

const router = Router();

router.get('/status', asyncHandler(getLicenseStatus));
router.put('/', requireRole(['SUPER_ADMIN']), asyncHandler(updateLicense));

export default router;
