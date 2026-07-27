/**
 * Authentication Middleware
 * Verifies JWT tokens and adds user info to request
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { TokenService } from '../../infrastructure/services/token.service';
import { logger } from '../../config/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        tenantId: string;
      };
    }
  }
}

/**
 * Authenticate middleware
 * Verifies JWT token and adds user to request
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload = TokenService.verifyToken(token);
    if (!payload) {
      return res.status(401).json({
        message: 'Invalid or expired token',
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        status: true,
        lockedUntil: true,
        tenant: { select: { status: true } },
      },
    });

    if (!user) {
      return res.status(401).json({
        message: 'User not found',
      });
    }

    // A suspended/inactive clinic must be cut off immediately — see auth.ts
    // for the identical check on the other auth stack, and login.use-case.ts
    // for the same gate at login time.
    if (user.tenant && user.tenant.status !== 'ACTIVE') {
      return res.status(403).json({
        message: `This clinic account is ${user.tenant.status.toLowerCase()}. Please contact support.`,
      });
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        message: `Account is ${user.status.toLowerCase()}`,
      });
    }

    // Check if user is locked
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      return res.status(403).json({
        message: 'Account is temporarily locked',
      });
    }

    // Add user info to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    next();
  } catch (error: any) {
    logger.error('Authentication error:', error);
    res.status(401).json({
      message: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user to request if token is valid, but doesn't fail if no token
 */
export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token, continue without user
    }

    const token = authHeader.substring(7);

    // Verify token
    const payload = TokenService.verifyToken(token);
    if (!payload) {
      return next(); // Invalid token, continue without user
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        status: true,
      },
    });

    if (user && user.status === 'ACTIVE') {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      };
    }

    next();
  } catch (error: any) {
    logger.error('Optional authentication error:', error);
    next(); // Continue without user on error
  }
};
