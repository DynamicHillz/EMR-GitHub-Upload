/**
 * Express Type Extensions
 *
 * Extends Express Request interface to include custom properties
 * added by middleware (e.g., authenticated user from JWT)
 */

import type { UserRole } from '../shared/types/prisma-enums.ts';;

declare global {
  namespace Express {
    interface Request {
      /**
       * Authenticated user information attached by auth middleware
       * Available on all protected routes after JWT validation
       */
      user?: {
        id: string;
        email: string;
        role: UserRole;
        tenantId: string;
      };
    }
  }
}

export {};
