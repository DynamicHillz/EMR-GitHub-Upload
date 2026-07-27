import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';
import { pushSyncData, getConflicts, resolveConflict, registerDevice } from '../controllers/sync.controller';

const router = Router();

// Reviewing/resolving sync conflicts is restricted the same as the
// "Sync Conflicts" nav item itself (MainLayout.tsx) — the route previously
// had no gate at all, so the nav-only restriction was cosmetic.
const CAN_REVIEW_CONFLICTS = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR']);

// Device registration and pushing queued writes stay open to any
// authenticated staff member — pushSyncData applies its own per-item,
// per-entity-type role check internally (see sync.controller.ts), since a
// single push batch can span multiple entity types with different rules.
router.post('/devices', asyncHandler(registerDevice));
router.post('/push', asyncHandler(pushSyncData));
router.get('/conflicts', CAN_REVIEW_CONFLICTS, asyncHandler(getConflicts));
router.post('/conflicts/:id/resolve', CAN_REVIEW_CONFLICTS, asyncHandler(resolveConflict));

export default router;
