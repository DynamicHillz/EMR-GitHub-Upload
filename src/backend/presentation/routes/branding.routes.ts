/**
 * Branding Routes
 *
 * Routes for managing tenant branding (logo, colors, theme)
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { uploadLogoMiddleware } from '../middleware/upload.middleware';
import {
  getBranding,
  getPublicBranding,
  updateBranding,
  uploadLogo
} from '../controllers/branding.controller';

const router = Router();

// Public endpoint for login page (no auth required)
router.get('/public', asyncHandler(getPublicBranding));

// All other routes require authentication
router.use(authMiddleware);

// Get branding settings
router.get('/', asyncHandler(getBranding));

// Update branding settings (Admin only)
router.put('/', requireRole(['SUPER_ADMIN', 'ADMIN']), asyncHandler(updateBranding));

// Upload logo (Admin only)
router.post('/upload-logo', requireRole(['SUPER_ADMIN', 'ADMIN']), uploadLogoMiddleware, asyncHandler(uploadLogo));

export default router;
