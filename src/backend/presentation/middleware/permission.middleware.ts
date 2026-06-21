/**
 * Permission Middleware
 * Role-based access control for protected routes
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';

/**
 * Role hierarchy for permission checking
 * Higher values have more privileges
 */
const ROLE_HIERARCHY = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  MANAGER: 70,
  DOCTOR: 50,
  NURSE: 40,
  PHARMACIST: 30,
  RECEPTIONIST: 20,
  PATIENT: 10,
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
 * Check if user belongs to the same tenant as the resource
 */
export const requireSameTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    // For now, this is a placeholder
    // In a real implementation, you would check if the resource belongs to the user's tenant
    // This requires fetching the resource from the database

    next();
  } catch (error: any) {
    logger.error('Tenant check error:', error);
    res.status(403).json({
      message: 'Tenant check failed',
    });
  }
};

/**
 * Predefined permission sets for common use cases
 */

// Admin only
export const adminOnly = requireRole('SUPER_ADMIN', 'ADMIN');

// Admin or Manager
export const adminOrManager = requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER');

// Medical staff (Doctors and Nurses)
export const medicalStaff = requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DOCTOR', 'NURSE');

// All staff (excluding patients)
export const staffOnly = requireRole(
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'DOCTOR',
  'NURSE',
  'PHARMACIST',
  'RECEPTIONIST'
);
