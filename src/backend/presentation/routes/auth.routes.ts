import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/errorHandler';
import * as authController from '../controllers/auth.controller';

const router = Router();

// Brute-force/credential-stuffing protection — scoped only to the 3 routes
// below (not /refresh or /logout, which an already-legitimately-logged-in
// session calls repeatedly and isn't a meaningful attack surface the same
// way). Same precedent as verification.routes.ts's PIN-brute-force limiter.
// This is now the ONLY meaningful rate limit on auth abuse — the general
// /api limiter (server.ts) was raised specifically because it was never
// actually protecting this; it was just throttling ordinary clinical usage.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // per IP
  message: {
    success: false,
    message: 'Too many attempts, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login - Login user
router.post('/login', authLimiter, asyncHandler(authController.login));

// POST /api/auth/logout - Logout user
router.post('/logout', asyncHandler(authController.logout));

// POST /api/auth/refresh - Refresh token
router.post('/refresh', asyncHandler(authController.refreshToken));

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', authLimiter, asyncHandler(authController.forgotPassword));

// POST /api/auth/reset-password - Reset password
router.post('/reset-password', authLimiter, asyncHandler(authController.resetPassword));

export default router;
