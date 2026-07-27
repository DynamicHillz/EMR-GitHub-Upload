/**
 * User Management Routes
 * Routes for user CRUD operations and status management
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth.middleware';
import { adminOnly, adminOrManager, requireOwnershipOrAdmin } from '../middleware/permission.middleware';
import {
  createUser,
  updateUser,
  getUser,
  listUsers,
  deactivateUser,
  suspendUser,
  reactivateUser,
  changePassword,
  adminForceResetPassword,
  listUserSessions,
  revokeUserSession,
} from '../controllers/user.controller';

const router = Router();

// Apply authentication to all user routes
router.use(authenticate);

/**
 * @route   GET /api/users/doctors
 * @desc    List all doctors (accessible to all authenticated users for appointment booking)
 * @access  Private (Any authenticated user)
 */
router.get('/doctors', asyncHandler(async (req: any, res: any) => {
  const { listUsers: listUsersController } = require('../controllers/user.controller');
  req.query.role = 'DOCTOR';
  req.query.status = 'ACTIVE';
  await listUsersController(req, res);
}));

/**
 * @route   GET /api/users
 * @desc    List all users with filters
 * @access  Private (Admin, Manager)
 * @query   role, status, search, limit, offset
 */
router.get('/', adminOrManager, asyncHandler(listUsers));

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Private (Admin only)
 */
router.post('/', adminOnly, asyncHandler(createUser));

/**
 * @route   POST /api/users/change-password
 * @desc    Change current user's password
 * @access  Private (Any authenticated user)
 */
router.post('/change-password', asyncHandler(changePassword));

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Owner or Admin)
 */
router.get('/:id', requireOwnershipOrAdmin(), asyncHandler(getUser));

/**
 * @route   PUT /api/users/:id
 * @desc    Update user details
 * @access  Private (Owner or Admin/Manager)
 */
router.put('/:id', requireOwnershipOrAdmin(), asyncHandler(updateUser));

/**
 * @route   POST /api/users/:id/deactivate
 * @desc    Deactivate user account
 * @access  Private (Admin only)
 */
router.post('/:id/deactivate', adminOnly, asyncHandler(deactivateUser));

/**
 * @route   POST /api/users/:id/suspend
 * @desc    Suspend user account
 * @access  Private (Admin only)
 * @body    until (optional) - suspension end date
 */
router.post('/:id/suspend', adminOnly, asyncHandler(suspendUser));

/**
 * @route   POST /api/users/:id/reactivate
 * @desc    Reactivate user account
 * @access  Private (Admin only)
 */
router.post('/:id/reactivate', adminOnly, asyncHandler(reactivateUser));
/**
 * @route   POST /api/users/:id/force-reset-password
 * @desc    Admin manually resets user password to default
 * @access  Private (Admin only)
 */
router.post('/:id/force-reset-password', adminOnly, asyncHandler(adminForceResetPassword));

/**
 * @route   GET /api/users/:id/sessions
 * @desc    List a user's active sessions (non-revoked, non-expired refresh tokens)
 * @access  Private (Admin only)
 */
router.get('/:id/sessions', adminOnly, asyncHandler(listUserSessions));

/**
 * @route   POST /api/users/:id/sessions/:sessionId/revoke
 * @desc    Revoke a single session, forcing that device to re-login
 * @access  Private (Admin only)
 */
router.post('/:id/sessions/:sessionId/revoke', adminOnly, asyncHandler(revokeUserSession));

export default router;
