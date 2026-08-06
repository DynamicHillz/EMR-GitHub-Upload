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
  LOGIN_FAILED = 'LOGIN_FAILED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
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
  billing: 'BILLING',
  // Previously unmapped entirely — every action under these route groups
  // silently fell to the generic 'SYSTEM' catch-all regardless of what it
  // actually was, with no way to filter for it on the Audit Log page.
  insurance: 'INSURANCE',
  exemptions: 'EXEMPTION_POLICY',
  anc: 'ANC',
  immunization: 'IMMUNIZATION',
  tenants: 'TENANT',
  'fraud-prevention': 'FRAUD_PREVENTION_SETTINGS',
  notifications: 'NOTIFICATION',
  sync: 'SYNC',
  triage: 'TRIAGE',
  labor: 'LABOR',
  verification: 'VERIFICATION',
  interoperability: 'INTEROPERABILITY',
  reports: 'REPORT',
  dashboard: 'DASHBOARD',
};

// Some route groups mount several distinct resource types under one shared
// prefix (e.g. /api/billing/invoices, /api/billing/payments, /api/billing/
// refunds all live under '/api/billing') — `resource` (pathParts[1]) is only
// ever that shared prefix, never the actual resource, so every billing/
// inpatient action was logging as the same generic 'BILLING'/'INPATIENT'
// entityType regardless of which one it actually was (e.g. the Audit Log
// UI's "Invoice"/"Payment" filters matched zero rows, since no row ever had
// that entityType). Look one segment deeper for these known groups.
const nestedResourceMap: Record<string, Record<string, string>> = {
  billing: {
    invoices: 'INVOICE',
    payments: 'PAYMENT',
    'gateway-payments': 'PAYMENT',
    refunds: 'REFUND',
    services: 'SERVICE_CATALOG',
  },
  inpatients: {
    wards: 'WARD',
    beds: 'WARD',
    admissions: 'INPATIENT',
    'operation-notes': 'INPATIENT',
    transfusions: 'INPATIENT',
  },
  // /api/pharmacy/medications, /api/pharmacy/dispense, etc. all live under
  // the shared '/api/pharmacy' prefix — same issue as billing/inpatients
  // above. resourceMap's own 'medications' entry (matching pathParts[1]
  // directly) has been dead code for the same reason: there's no top-level
  // /api/medications mount, so it never matched anything either.
  pharmacy: {
    medications: 'MEDICATION',
    dispense: 'MEDICATION',
  },
  // /api/insurance/providers, /api/insurance/patients/:patientId (policy
  // enrollment), /api/insurance/claims — same grouped-prefix pattern.
  insurance: {
    providers: 'INSURANCE_PROVIDER',
    patients: 'PATIENT_INSURANCE',
    claims: 'INSURANCE_CLAIM',
  },
};

/**
 * Resolve the audit entityType from a request's path segments (already
 * split on '/' and filtered of empties, e.g. ['api', 'billing', 'invoices',
 * '123']). Exported for direct unit testing of the nested-resource fix.
 */
export function resolveEntityType(pathParts: string[]): string {
  const resource = pathParts[1];
  const nestedResource = pathParts[2];
  const nestedType = nestedResourceMap[resource]?.[nestedResource];
  return nestedType || resourceMap[resource] || 'SYSTEM';
}

const idShapePattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$|^\d+$/;

// Query param names confirmed in actual use across controllers (grep for
// `req.query.<name>` / destructured `req.query`) that unambiguously name the
// entity they reference. Deliberately not a guessed/exhaustive list — only
// names this codebase actually uses today.
const QUERY_PARAM_ENTITY_TYPES: Record<string, string> = {
  patientId: 'PATIENT',
  invoiceId: 'INVOICE',
  doctorId: 'USER',
  consultationId: 'CONSULTATION',
  admissionId: 'INPATIENT',
  ancVisitId: 'ANC',
};

export interface ResolvedEntity {
  entityId?: string;
  // Set only when a NAMED query param (e.g. ?invoiceId=X) identifies the
  // entity — overrides the path-derived entityType, since the query param's
  // name is a stronger, unambiguous signal of what's actually being looked
  // at than the URL's resource segment is. E.g. GET /billing/payments
  // ?invoiceId=X is "show invoice X's payment history" — the invoice is the
  // real subject, not some anonymous 'PAYMENT' record (there is no single
  // payment here; grabbing the query value as if it were a payment id, with
  // no matching override, made the row un-resolvable to any real name).
  entityTypeOverride?: string;
}

/**
 * Resolve the audit entityId (and, where a named query param earns it, an
 * entityType override) for a request. Checked in order: (1) every path
 * segment for something ID-shaped (UUID/numeric) — nested routes like
 * /api/inpatients/admissions/:id/vitals/:recordId have more than one, so the
 * LAST match wins (favors the most specific entity actually being written,
 * e.g. recordId over admissionId); (2) a query param whose name is in
 * QUERY_PARAM_ENTITY_TYPES, carrying its type override; (3) any other
 * ID-shaped query value, with no override (better than nothing for an
 * unrecognized key, path-derived entityType stays as-is); (4) body.id, for
 * offline-sync/pre-assigned-id creates. Exported for direct unit testing.
 */
export function resolveEntity(pathParts: string[], query: Record<string, unknown>, body: any): ResolvedEntity {
  let entityId: string | undefined;
  for (const part of pathParts) {
    if (idShapePattern.test(part)) {
      entityId = part;
    }
  }
  if (entityId) return { entityId };

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      const type = QUERY_PARAM_ENTITY_TYPES[key];
      if (type && typeof value === 'string' && idShapePattern.test(value)) {
        return { entityId: value, entityTypeOverride: type };
      }
    }
    for (const value of Object.values(query)) {
      if (typeof value === 'string' && idShapePattern.test(value)) {
        return { entityId: value };
      }
    }
  }
  if (body && body.id) {
    return { entityId: body.id };
  }
  return {};
}

/**
 * Best-effort extraction of a created record's id from a controller's JSON
 * response — used as a fallback for CREATE (POST) actions, whose URL never
 * contains the new record's id (unlike PUT/PATCH/DELETE, which already get
 * entityId from the path). Covers the two response shapes actually used
 * across controllers in this codebase: `{ data: { id } }` and a bare `{ id }`.
 */
export function extractIdFromResponse(data: any): string | undefined {
  if (data && typeof data === 'object') {
    if (typeof data.id === 'string') return data.id;
    if (data.data && typeof data.data === 'object' && typeof data.data.id === 'string') return data.data.id;
  }
  return undefined;
}

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
      entityType = resolveEntityType(pathParts);
      const resolved = resolveEntity(pathParts, req.query as Record<string, unknown>, req.body);
      entityId = resolved.entityId;
      if (resolved.entityTypeOverride) {
        entityType = resolved.entityTypeOverride;
      }

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

          // CREATE actions have no id in their URL — the new record's id
          // only exists in the response. Fallback only (never overrides an
          // id already found in the path), so PUT/PATCH/DELETE are unaffected.
          if (!entityId && method === 'POST') {
            entityId = extractIdFromResponse(responseData);
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
