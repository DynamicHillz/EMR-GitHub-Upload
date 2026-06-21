/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */

import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { LoginUseCase } from '../../application/use-cases/auth/login.use-case';
import { RegisterUseCase } from '../../application/use-cases/auth/register.use-case';
import { ForgotPasswordUseCase } from '../../application/use-cases/auth/forgot-password.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/auth/reset-password.use-case';
import { LogoutUseCase } from '../../application/use-cases/auth/logout.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/auth/refresh-token.use-case';
import {
  validateRegisterUser,
  validateLoginUser,
  validateForgotPassword,
  validateResetPassword,
} from '../../application/validators/user.validator';
import { logger } from '../../config/logger';

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = validateRegisterUser(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.details.map((detail) => detail.message),
      });
    }

    // Execute use case
    const registerUseCase = new RegisterUseCase(prisma);
    const result = await registerUseCase.execute(value);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: result.id,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        role: result.role,
        tenantId: result.tenantId,
      },
      token: result.token,
      refreshToken: result.refreshToken,
    });
  } catch (error: any) {
    logger.error('Register error:', error);
    res.status(400).json({
      message: error.message || 'Registration failed',
    });
  }
};

/**
 * Login user
 */
export const login = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = validateLoginUser(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.details.map((detail) => detail.message),
      });
    }

    // Get tenant ID from request body, or find user's tenant by email
    let tenantId = req.body.tenantId;

    if (!tenantId) {
      // Auto-detect tenant from email
      const user = await prisma.user.findFirst({
        where: { email: value.email },
        select: { tenantId: true },
      });

      if (user) {
        tenantId = user.tenantId;
      } else {
        return res.status(401).json({
          message: 'Invalid email or password',
        });
      }
    }

    // Execute use case
    const loginUseCase = new LoginUseCase(prisma);
    const result = await loginUseCase.execute(value, tenantId);

    res.json({
      message: 'Login successful',
      user: result.user,
      token: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error: any) {
    logger.error('Login error:', error);

    // Check for specific error messages
    const message = error.message || 'Login failed';

    // Return 401 for authentication failures, 403 for account status issues
    if (message.includes('locked') || message.includes('suspended') || message.includes('inactive')) {
      return res.status(403).json({ message });
    }

    if (message.includes('Invalid credentials')) {
      return res.status(401).json({ message });
    }

    res.status(400).json({ message });
  }
};

/**
 * Logout user
 */
export const logout = async (req: Request, res: Response) => {
  try {
    // Get refresh token from body or header
    const refreshToken = req.body.refreshToken || req.header('X-Refresh-Token');

    // Get user ID from authenticated request
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    // Execute use case
    const logoutUseCase = new LogoutUseCase(prisma);
    const result = await logoutUseCase.execute(userId, refreshToken);

    res.json(result);
  } catch (error: any) {
    logger.error('Logout error:', error);
    res.status(400).json({
      message: error.message || 'Logout failed',
    });
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    // Get refresh token from body or header
    const refreshToken = req.body.refreshToken || req.header('X-Refresh-Token');

    if (!refreshToken) {
      return res.status(400).json({
        message: 'Refresh token is required',
      });
    }

    // Execute use case
    const refreshTokenUseCase = new RefreshTokenUseCase(prisma);
    const result = await refreshTokenUseCase.execute(refreshToken);

    res.json({
      message: 'Token refreshed successfully',
      token: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error: any) {
    logger.error('Refresh token error:', error);
    res.status(401).json({
      message: error.message || 'Token refresh failed',
    });
  }
};

/**
 * Forgot password - Send reset token
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = validateForgotPassword(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.details.map((detail) => detail.message),
      });
    }

    // Execute use case
    const forgotPasswordUseCase = new ForgotPasswordUseCase(prisma);
    const result = await forgotPasswordUseCase.execute(value);

    // Always return success to prevent email enumeration
    res.json(result);
  } catch (error: any) {
    logger.error('Forgot password error:', error);

    // Still return success to prevent email enumeration
    res.json({
      message: 'If the email exists, a password reset link has been sent',
    });
  }
};

/**
 * Reset password using token
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = validateResetPassword(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.details.map((detail) => detail.message),
      });
    }

    // Execute use case
    const resetPasswordUseCase = new ResetPasswordUseCase(prisma);
    const result = await resetPasswordUseCase.execute(value);

    res.json(result);
  } catch (error: any) {
    logger.error('Reset password error:', error);
    res.status(400).json({
      message: error.message || 'Password reset failed',
    });
  }
};
