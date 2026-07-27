/**
 * Permission Middleware
 * Role-based access control for protected routes
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';

/**
 * Role hierarchy for permission checking
 * Higher values have more privileges
 *
 * Must mirror the Prisma `UserRole` enum exactly — this previously included
 * `MANAGER`/`PATIENT` (not real roles; no account can ever hold them, so
 * checks involving them were silent no-ops) and was missing `LAB_TECH`/
 * `CASHIER` (real roles that fell through to level 0 via requireMinRole's
 * `|| 0` fallback, i.e. treated as the lowest possible privilege).
 */
const ROLE_HIERARCHY = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  DOCTOR: 50,
  NURSE: 40,
  PHARMACIST: 30,
  LAB_TECH: 30,
  CASHIER: 20,
  RECEPTIONIST: 20,
};

/**
 * Check if user has required role
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
        });
      }

      // Check if user's role is in the allowed roles
      if (!allowedRoles.includes(user.role)) {
        logger.warn(`Access denied for user ${user.id} with role ${user.role}. Required: ${allowedRoles.join(', ')}`);
        return res.status(403).json({
          message: 'Access denied. Insufficient permissions.',
        });
      }

      next();
    } catch (error: any) {
      logger.error('Permission check error:', error);
      res.status(403).json({
        message: 'Permission check failed',
      });
    }
  };
};

/**
 * Check if user has minimum role level
 * User's role must be equal to or higher than the minimum role
 */
export const requireMinRole = (minRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
        });
      }

      const userRoleLevel = ROLE_HIERARCHY[user.role as keyof typeof ROLE_HIERARCHY] || 0;
      const minRoleLevel = ROLE_HIERARCHY[minRole as keyof typeof ROLE_HIERARCHY] || 0;

      if (userRoleLevel < minRoleLevel) {
        logger.warn(`Access denied for user ${user.id} with role ${user.role}. Minimum required: ${minRole}`);
        return res.status(403).json({
          message: 'Access denied. Insufficient permissions.',
        });
      }

      next();
    } catch (error: any) {
      logger.error('Permission check error:', error);
      res.status(403).json({
        message: 'Permission check failed',
      });
    }
  };
};

/**
 * Check if user is accessing their own resource or has admin privileges
 */
export const requireOwnershipOrAdmin = (userIdParam: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
        });
      }

      const resourceUserId = req.params[userIdParam];

      // Check if user is accessing their own resource
      const isOwner = user.id === resourceUserId;

      // Check if user has admin privileges
      const userRoleLevel = ROLE_HIERARCHY[user.role as keyof typeof ROLE_HIERARCHY] || 0;
      const isAdmin = userRoleLevel >= ROLE_HIERARCHY.ADMIN;

      if (!isOwner && !isAdmin) {
        logger.warn(`Access denied for user ${user.id}. Not owner and not admin.`);
        return res.status(403).json({
          message: 'Access denied. You can only access your own resources.',
        });
      }

      next();
    } catch (error: any) {
      logger.error('Ownership check error:', error);
      res.status(403).json({
        message: 'Permission check failed',
      });
    }
  };
};

/**
 * Predefined permission sets for common use cases
 */

// Admin only
export const adminOnly = requireRole('SUPER_ADMIN', 'ADMIN');

// Admin or Manager (kept as a distinct export even though it's currently
// identical to adminOnly now that the non-existent MANAGER role is gone —
// route files import it by name and a MANAGER role may legitimately be
// added to the schema in the future)
export const adminOrManager = requireRole('SUPER_ADMIN', 'ADMIN');

// Medical staff (Doctors and Nurses)
export const medicalStaff = requireRole('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE');

// All staff (excluding patients)
export const staffOnly = requireRole(
  'SUPER_ADMIN',
  'ADMIN',
  'DOCTOR',
  'NURSE',
  'PHARMACIST',
  'RECEPTIONIST',
  'LAB_TECH',
  'CASHIER'
);
