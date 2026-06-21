/**
 * Tenant Validation Middleware
 *
 * Ensures that authenticated requests have valid tenant context
 * and prevents cross-tenant data access.
 */

import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/AppError';

/**
 * Middleware to require tenant ID in authenticated request
 * Attaches tenantId to request for easy access in controllers
 *
 * @throws UnauthorizedError if tenant ID is missing
 */
export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    throw new UnauthorizedError('Tenant ID missing from authentication context');
  }

  // Tenant ID is already available via req.user.tenantId
  // No need to attach separately since we have proper typing
  next();
}

/**
 * Middleware factory to validate tenant access to a specific resource
 * Use this when you need to verify that a resource belongs to the user's tenant
 *
 * @param getTenantId - Function that extracts tenant ID from request/resource
 * @returns Middleware function
 * @throws ForbiddenError if tenant IDs don't match
 *
 * @example
 * // In a route handler, after fetching a resource:
 * router.get('/patients/:id', authenticate, async (req, res, next) => {
 *   const patient = await getPatient(req.params.id);
 *   validateTenantAccess(patient.tenantId)(req, res, next);
 * });
 */
export function validateTenantAccess(resourceTenantId: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userTenantId = req.user?.tenantId;

    if (!userTenantId) {
      throw new UnauthorizedError('Tenant ID missing from authentication context');
    }

    if (resourceTenantId !== userTenantId) {
      throw new ForbiddenError('Access denied: Resource belongs to different tenant');
    }

    next();
  };
}

/**
 * Extract tenant ID from authenticated request
 * Helper function for use in controllers
 *
 * @param req - Express request object
 * @returns Tenant ID
 * @throws UnauthorizedError if tenant ID is missing
 */
export function getTenantId(req: Request): string {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    throw new UnauthorizedError('Tenant ID missing from authentication context');
  }

  return tenantId;
}
