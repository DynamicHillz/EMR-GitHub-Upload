import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { logger } from '../../config/logger';
import { prisma } from '../../infrastructure/database/prisma.client';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No authentication token provided', 401);
    }

    const token = authHeader.substring(7);

    // Verify token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('FATAL: JWT_SECRET environment variable is not set');
      throw new AppError('Server configuration error', 500);
    }
    const decoded = jwt.verify(token, jwtSecret) as AuthUser;

    // Live status check, every request — this stack previously trusted the
    // JWT's role/tenantId claims for up to JWT_EXPIRY (1h) after issuance,
    // so a suspension, deactivation, lockout, or role change didn't take
    // effect until the token expired. One combined query (not two separate
    // lookups) fetches the user and their tenant's current status together,
    // and req.user is rebuilt from these fresh DB values below rather than
    // the token payload — mirroring auth.middleware.ts's (the other auth
    // stack) equivalent checks, so both stacks now enforce the same
    // guarantees without migrating every route off this one.
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
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
      throw new AppError('Account no longer exists', 401);
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError(`Account is ${user.status.toLowerCase()}. Please contact administrator.`, 403);
    }
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      throw new AppError('Account is temporarily locked', 403);
    }
    if (user.tenant && user.tenant.status !== 'ACTIVE') {
      throw new AppError(`This clinic account is ${user.tenant.status.toLowerCase()}. Please contact support.`, 403);
    }

    // Attach the freshly-verified user (not the possibly-stale JWT payload)
    req.user = { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token:', error.message);
      return next(new AppError('Invalid authentication token', 401));
    }

    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired JWT token');
      return next(new AppError('Authentication token expired', 401));
    }

    next(error);
  }
};

export const requireRole = (roles: string[], deniedMessage?: string) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }


    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(deniedMessage || 'Insufficient permissions to access this resource', 403)
      );
    }

    next();
  };
};

export const requireTenant = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user?.tenantId) {
    return next(new AppError('Tenant context required', 400));
  }
  next();
};
