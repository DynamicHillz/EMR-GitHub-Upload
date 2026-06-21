/**
 * Audit Middleware
 * Logs API requests and changes for compliance
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { logger } from '../../config/logger';

/**
 * Action types for audit logging
 */
export enum AuditAction {
  // User actions
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_REACTIVATED = 'USER_REACTIVATED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET = 'PASSWORD_RESET',

  // Patient actions
  PATIENT_CREATED = 'PATIENT_CREATED',
  PATIENT_UPDATED = 'PATIENT_UPDATED',
  PATIENT_VIEWED = 'PATIENT_VIEWED',
  PATIENT_DELETED = 'PATIENT_DELETED',

  // Appointment actions
  APPOINTMENT_CREATED = 'APPOINTMENT_CREATED',
  APPOINTMENT_UPDATED = 'APPOINTMENT_UPDATED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_COMPLETED = 'APPOINTMENT_COMPLETED',

  // Consultation actions
  CONSULTATION_CREATED = 'CONSULTATION_CREATED',
  CONSULTATION_UPDATED = 'CONSULTATION_UPDATED',
  CONSULTATION_VIEWED = 'CONSULTATION_VIEWED',

  // Billing actions
  INVOICE_CREATED = 'INVOICE_CREATED',
  INVOICE_UPDATED = 'INVOICE_UPDATED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',

  // Pharmacy actions
  PRESCRIPTION_CREATED = 'PRESCRIPTION_CREATED',
  PRESCRIPTION_DISPENSED = 'PRESCRIPTION_DISPENSED',
  MEDICATION_UPDATED = 'MEDICATION_UPDATED',

  // System actions
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',
  SYSTEM_ACCESS = 'SYSTEM_ACCESS',
}

/**
 * Entity types for audit logging
 */
export enum EntityType {
  USER = 'USER',
  PATIENT = 'PATIENT',
  APPOINTMENT = 'APPOINTMENT',
  CONSULTATION = 'CONSULTATION',
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  PRESCRIPTION = 'PRESCRIPTION',
  MEDICATION = 'MEDICATION',
  SETTING = 'SETTING',
}

/**
 * Create audit log entry
 */
export const createAuditLog = async (
  userId: string,
  tenantId: string,
  action: AuditAction | string,
  entityType: EntityType | string,
  entityId?: string,
  changes?: any,
  ipAddress?: string,
  userAgent?: string
) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        tenantId,
        action,
        entityType,
        entityId: entityId || null,
        metadata: changes ? JSON.stringify(changes) : null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (error: any) {
    logger.error('Audit log creation error:', error);
    // Don't throw error - audit logging should not break the main flow
  }
};

/**
 * Middleware to automatically log all API requests
 */
export const auditRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    // Only log authenticated requests
    if (!user) {
      return next();
    }

    // Skip logging for certain routes
    const skipRoutes = ['/api/health', '/api/ping'];
    if (skipRoutes.includes(req.path)) {
      return next();
    }

    // Get request details
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    const method = req.method;
    const path = req.path;

    // Determine action based on method and path
    let action = 'SYSTEM_ACCESS';
    let entityType = 'SYSTEM';
    let entityId: string | undefined;

    // Extract entity information from path
    const pathParts = path.split('/').filter((p) => p);
    if (pathParts.length >= 3) {
      const resource = pathParts[1]; // e.g., 'users', 'patients'
      entityId = pathParts[2]; // resource ID if present

      // Map resource to entity type
      const resourceMap: Record<string, EntityType> = {
        users: EntityType.USER,
        patients: EntityType.PATIENT,
        appointments: EntityType.APPOINTMENT,
        consultations: EntityType.CONSULTATION,
        invoices: EntityType.INVOICE,
        payments: EntityType.PAYMENT,
        prescriptions: EntityType.PRESCRIPTION,
        medications: EntityType.MEDICATION,
      };

      entityType = resourceMap[resource] || 'SYSTEM';

      // Map method to action
      if (method === 'POST') action = `${entityType}_CREATED`;
      else if (method === 'PUT' || method === 'PATCH') action = `${entityType}_UPDATED`;
      else if (method === 'DELETE') action = `${entityType}_DELETED`;
      else if (method === 'GET') action = `${entityType}_VIEWED`;
    }

    // Store original response.json to capture response data
    const originalJson = res.json.bind(res);
    let responseData: any;

    res.json = function (data: any) {
      responseData = data;
      return originalJson(data);
    };

    // Wait for response to finish
    res.on('finish', async () => {
      try {
        // Only log successful requests (2xx status codes)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Create changes object
          const changes: any = {
            method,
            path,
            timestamp: new Date().toISOString(),
          };

          // Include request body for write operations (sanitized)
          if (['POST', 'PUT', 'PATCH'].includes(method)) {
            const sanitizedBody = { ...req.body };
            // Remove sensitive fields
            delete sanitizedBody.password;
            delete sanitizedBody.currentPassword;
            delete sanitizedBody.newPassword;
            changes.requestBody = sanitizedBody;
          }

          // Include response data if available
          if (responseData) {
            changes.response = {
              status: res.statusCode,
            };
          }

          await createAuditLog(
            user.id,
            user.tenantId,
            action,
            entityType,
            entityId,
            changes,
            ipAddress,
            userAgent
          );
        }
      } catch (error: any) {
        logger.error('Error logging audit trail:', error);
        // Don't fail the request
      }
    });

    next();
  } catch (error: any) {
    logger.error('Audit middleware error:', error);
    next(); // Continue even if audit fails
  }
};

/**
 * Middleware for specific audit actions
 * Use this when you need to log a specific action with custom details
 */
export const auditAction = (
  action: AuditAction | string,
  entityType: EntityType | string,
  getEntityId?: (req: Request) => string | undefined,
  getChanges?: (req: Request) => any
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        return next();
      }

      const entityId = getEntityId ? getEntityId(req) : undefined;
      const changes = getChanges ? getChanges(req) : undefined;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';

      await createAuditLog(
        user.id,
        user.tenantId,
        action,
        entityType,
        entityId,
        changes,
        ipAddress,
        userAgent
      );

      next();
    } catch (error: any) {
      logger.error('Audit action error:', error);
      next(); // Continue even if audit fails
    }
  };
};
