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

    // Skip logging for health/ping routes and audit self-referencing
    const skipRoutes = ['/api/health', '/api/ping', '/api/audit'];
    if (skipRoutes.some(r => req.path.startsWith(r))) {
      return next();
    }

    // For GET requests, only audit access to sensitive clinical data
    if (req.method === 'GET') {
      const sensitivePatterns = [
        /^\/api\/patients\/[^/]+/,       // Patient record access
        /^\/api\/consultations\/[^/]+/,   // Consultation record access
        /^\/api\/lab\//,                  // Lab data access
        /^\/api\/prescriptions\//,        // Prescription data access
        /^\/api\/billing\/[^/]+/,         // Billing record access
        /^\/api\/users\/[^/]+/,           // User record access
      ];
      const pathWithoutQuery = req.originalUrl.split('?')[0];
      const isSensitive = sensitivePatterns.some(p => p.test(pathWithoutQuery));
      if (!isSensitive) {
        return next();
      }
    }

    // Get request details
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    const method = req.method;
    const path = req.originalUrl || req.path;

    // Determine action based on method and path
    let action = 'SYSTEM_ACCESS';
    let entityType = 'SYSTEM';
    let entityId: string | undefined;

    // Extract entity information from path
    // Remove query params from path for splitting
    const pathWithoutQuery = path.split('?')[0];
    const pathParts = pathWithoutQuery.split('/').filter((p) => p);
    if (pathParts.length >= 2) {
      // e.g. /api/patients/123/vitals -> pathParts = ['api', 'patients', '123', 'vitals']
      // pathParts[0] is always 'api'
      const resource = pathParts[1];

      // Scan every path segment for something ID-shaped (UUID, or numeric)
      // rather than assuming the ID always sits at a fixed index — nested
      // routes like /api/inpatients/admissions/:id/vitals/:recordId have
      // more than one ID segment, and a fixed index picks up a literal path
      // word ('admissions') instead. Taking the LAST match favors the most
      // specific entity actually being written (recordId over admissionId).
      const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      for (const part of pathParts) {
        if (uuidPattern.test(part) || /^\d+$/.test(part)) {
          entityId = part;
        }
      }
      if (!entityId && req.body && req.body.id) {
        entityId = req.body.id;
      }

      // Expanded Map resource to entity type
      const resourceMap: Record<string, string> = {
        users: 'USER',
        patients: 'PATIENT',
        appointments: 'APPOINTMENT',
        consultations: 'CONSULTATION',
        invoices: 'INVOICE',
        payments: 'PAYMENT',
        prescriptions: 'PRESCRIPTION',
        medications: 'MEDICATION',
        inpatients: 'INPATIENT',
        admissions: 'INPATIENT',
        wards: 'WARD',
        lab: 'LAB',
        pharmacy: 'PHARMACY',
        clinical: 'CLINICAL',
        billing: 'BILLING'
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
            deviceId: req.headers['x-device-id'] || null,
            sessionId: req.headers['x-session-id'] || null,
          };

          // Include request body for write operations (sanitized)
          if (['POST', 'PUT', 'PATCH'].includes(method)) {
            const sanitizedBody = { ...req.body };
            // Remove sensitive fields
            delete sanitizedBody.password;
            delete sanitizedBody.currentPassword;
            delete sanitizedBody.newPassword;
            
            // Truncate large payloads to prevent DB crashes (max 5KB per field)
            Object.keys(sanitizedBody).forEach(key => {
              if (typeof sanitizedBody[key] === 'string' && sanitizedBody[key].length > 5000) {
                sanitizedBody[key] = sanitizedBody[key].substring(0, 5000) + '... [TRUNCATED]';
              }
            });
            changes.requestBody = sanitizedBody;
          }

          // Truncate response data if available
          if (responseData) {
             const statusObj = { status: res.statusCode };
             changes.response = statusObj;
          }

          // We use setTimeout to execute this asynchronously so it does not block the API response
          setTimeout(async () => {
            try {
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
            } catch (err) {
              logger.error('Async audit log creation error:', err);
            }
          }, 0);
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
