import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { logger } from '../../config/logger';

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
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as AuthUser;

    // Attach user to request
    req.user = decoded;

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

export const requireRole = (roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Insufficient permissions to access this resource', 403)
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
