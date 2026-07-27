/**
 * Sync Controller
 *
 * Receives queued writes from an offline-capable client (see
 * src/frontend/services/offlineQueue.ts) and applies them against the real
 * entity tables — through each entity's actual update path, so business
 * rules and audit logging still run — using each record's `version` field
 * for optimistic-concurrency conflict detection.
 *
 * Scope: UPDATE operations are supported for PATIENT, CONSULTATION,
 * APPOINTMENT, and INVOICE — the entities with a real "edit this record"
 * path today. CREATE is supported for TRIAGE, using the client-generated
 * entity id as the idempotency key (see applyCreate below). Other
 * operation/entity-type combinations are explicitly not yet supported and
 * return a clear per-item error rather than silently no-op'ing or crashing.
 */

import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { logger } from '../../config/logger';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';
import { PatientRepository } from '../../infrastructure/database/repositories/patient.repository';
import { UpdatePatientUseCase } from '../../application/use-cases/patient/update-patient.use-case';
import { RegisterPatientUseCase } from '../../application/use-cases/patient/register-patient.use-case';
import { RegisterPatientDto } from '../../application/dtos/patient/RegisterPatient.dto';
import { PatientIdGenerator } from '../../infrastructure/generators/patient-id.generator';
import { ConsultationRepository } from '../../infrastructure/database/repositories/consultation.repository';
import { UpdateConsultationUseCase } from '../../application/use-cases/consultation/update-consultation.use-case';
import { AppointmentRepository } from '../../infrastructure/database/repositories/appointment.repository';
import { UpdateInvoiceUseCase } from '../../application/use-cases/billing/update-invoice.use-case';
import { TriageService } from '../../domain/services/triage.service';

const patientRepository = new PatientRepository(prisma);
const updatePatientUseCase = new UpdatePatientUseCase(patientRepository);
const patientIdGenerator = new PatientIdGenerator(prisma);
const registerPatientUseCase = new RegisterPatientUseCase(patientRepository, patientIdGenerator, prisma);
const consultationRepository = new ConsultationRepository(prisma);
const updateConsultationUseCase = new UpdateConsultationUseCase(consultationRepository);
const appointmentRepository = new AppointmentRepository(prisma);
const updateInvoiceUseCase = new UpdateInvoiceUseCase(prisma);
const triageService = new TriageService();

const SUPPORTED_UPDATE_ENTITY_TYPES = ['PATIENT', 'CONSULTATION', 'APPOINTMENT', 'INVOICE'];
const SUPPORTED_CREATE_ENTITY_TYPES = ['TRIAGE', 'PATIENT'];

// Offline sync replays through the same use-cases/services the gated REST
// routes use, but — unlike those routes — had no role check of its own, so
// any authenticated role could push e.g. a CONSULTATION update (normally
// DOCTOR-only) or an INVOICE update (normally CASHIER+-only). This mirrors
// each entity's real route-level gate exactly (see patient.routes.ts,
// consultation.routes.ts, appointment.routes.ts, billing.routes.ts,
// triage.routes.ts) — keyed by operation as well as entity type, since e.g.
// Patient CREATE (front-desk/clinical staff only) and Patient UPDATE (also
// open to admin accounts correcting a record) are gated differently.
const ALLOWED_ROLES: Record<string, Record<string, string[]>> = {
  PATIENT: {
    UPDATE: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
    CREATE: ['DOCTOR', 'NURSE', 'RECEPTIONIST'],
  },
  CONSULTATION: { UPDATE: ['DOCTOR'] },
  APPOINTMENT: { UPDATE: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] },
  INVOICE: { UPDATE: ['SUPER_ADMIN', 'ADMIN', 'CASHIER'] },
  TRIAGE: { CREATE: ['NURSE'] },
};

export interface SyncChange {
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, any>;
  baseVersion?: number;
}

interface SyncChangeResult {
  entityId: string;
  status: 'APPLIED' | 'CONFLICT' | 'ERROR';
  message?: string;
  syncQueueId?: string;
}

/**
 * Applies one already-version-checked UPDATE via the entity's real update
 * path — this is what makes the change actually take effect, unlike the
 * previous implementation which marked the queue item COMPLETED without
 * writing anything.
 */
async function applyUpdate(entityType: string, entityId: string, payload: Record<string, any>, tenantId: string, baseVersion: number | undefined): Promise<void> {
  switch (entityType) {
    case 'PATIENT':
      await updatePatientUseCase.execute(entityId, { ...payload, version: baseVersion }, tenantId);
      return;
    case 'CONSULTATION':
      await updateConsultationUseCase.execute(entityId, { ...payload, version: baseVersion }, tenantId);
      return;
    case 'APPOINTMENT':
      await appointmentRepository.update(entityId, tenantId, payload, baseVersion);
      return;
    case 'INVOICE':
      await updateInvoiceUseCase.execute(entityId, { ...payload, version: baseVersion }, tenantId, payload.issuedById || '');
      return;
    default:
      throw new ValidationError(`Offline sync does not support entity type: ${entityType}`);
  }
}

/**
 * Applies one CREATE. The client generates the entity's own id up front
 * (see offlineQueue.ts), so that id is the idempotency key: if a record
 * with it already exists, this replay already succeeded once — return
 * ALREADY_APPLIED instead of erroring or creating a duplicate.
 */
async function applyCreate(entityType: string, entityId: string, payload: Record<string, any>, tenantId: string, userId: string): Promise<'APPLIED' | 'ALREADY_APPLIED'> {
  switch (entityType) {
    case 'TRIAGE': {
      const existing = await prisma.triage.findFirst({ where: { id: entityId, tenantId } });
      if (existing) return 'ALREADY_APPLIED';

      // Reuse the real service (same one triage.controller.ts's REST create
      // path calls) instead of a second, independently-written prisma.triage
      // .create — the two copies could otherwise silently drift apart.
      await triageService.createTriageRecord(tenantId, userId, { ...payload, id: entityId });
      return 'APPLIED';
    }
    case 'PATIENT': {
      const existing = await prisma.patient.findFirst({ where: { id: entityId, tenantId } });
      if (existing) return 'ALREADY_APPLIED';

      // Reuse the real use-case (same one patient.controller.ts's REST
      // register path calls) — patientId sequence generation and the
      // duplicate-phone check both need to run against current server
      // state at the moment this actually applies, whether that's
      // immediately (online) or later (replay), not at queue time.
      // payload is untyped wire data (Record<string, any>) — its required
      // fields are enforced at runtime by RegisterPatientUseCase itself
      // (and by Joi on the normal REST path), not by the compiler here.
      await registerPatientUseCase.execute({ ...payload, id: entityId } as RegisterPatientDto, tenantId);
      return 'APPLIED';
    }
    default:
      throw new ValidationError(`Offline sync does not support CREATE for entity type: ${entityType}`);
  }
}

export const pushSyncData = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!tenantId || !userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { deviceId, changes } = req.body as { deviceId?: string; changes?: SyncChange[] };
    if (!deviceId || !changes || !Array.isArray(changes)) {
      return res.status(400).json({ success: false, message: 'Invalid payload — deviceId and changes[] are required' });
    }

    const device = await prisma.syncDevice.findFirst({
      where: { tenantId, deviceId, status: 'ACTIVE' },
    });
    if (!device) {
      return res.status(403).json({
        success: false,
        message: 'Unknown or inactive device — register it first via POST /api/sync/devices',
      });
    }

    const results: SyncChangeResult[] = [];

    for (const change of changes) {
      const { entityType, entityId, operation, payload, baseVersion } = change;
      const upperEntityType = entityType?.toUpperCase();

      const isSupportedUpdate = operation === 'UPDATE' && SUPPORTED_UPDATE_ENTITY_TYPES.includes(upperEntityType);
      const isSupportedCreate = operation === 'CREATE' && SUPPORTED_CREATE_ENTITY_TYPES.includes(upperEntityType);

      if (!isSupportedUpdate && !isSupportedCreate) {
        const syncQueue = await prisma.syncQueue.create({
          data: {
            deviceId: device.id,
            entityType: upperEntityType,
            entityId,
            operation: operation as any,
            payload: JSON.stringify(payload),
            status: 'FAILED',
            errorMessage: `${operation} on ${upperEntityType} is not yet supported by offline sync`,
          },
        });
        results.push({
          entityId,
          status: 'ERROR',
          message: `${operation} on ${upperEntityType} is not yet supported by offline sync`,
          syncQueueId: syncQueue.id,
        });
        continue;
      }

      const allowedRoles = ALLOWED_ROLES[upperEntityType]?.[operation] || [];
      if (!userRole || !allowedRoles.includes(userRole)) {
        const syncQueue = await prisma.syncQueue.create({
          data: {
            deviceId: device.id,
            entityType: upperEntityType,
            entityId,
            operation: operation as any,
            payload: JSON.stringify(payload),
            status: 'FAILED',
            errorMessage: `Your role does not have permission to ${operation.toLowerCase()} ${upperEntityType}`,
          },
        });
        results.push({
          entityId,
          status: 'ERROR',
          message: `Your role does not have permission to ${operation.toLowerCase()} ${upperEntityType}`,
          syncQueueId: syncQueue.id,
        });
        continue;
      }

      try {
        if (isSupportedCreate) {
          await applyCreate(upperEntityType, entityId, payload, tenantId, userId);
        } else {
          await applyUpdate(upperEntityType, entityId, payload, tenantId, baseVersion);
        }

        const syncQueue = await prisma.syncQueue.create({
          data: {
            deviceId: device.id,
            entityType: upperEntityType,
            entityId,
            operation: operation as any,
            payload: JSON.stringify(payload),
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });
        results.push({ entityId, status: 'APPLIED', syncQueueId: syncQueue.id });
      } catch (err: any) {
        // A ConflictError on CREATE (e.g. duplicate phone number) isn't a
        // stale-version conflict — there's no "server version" to compare
        // against, just a business-rule rejection. Route it through the
        // plain FAILED path below instead of the version-conflict/
        // SyncConflict machinery, which assumes an UPDATE.
        if (err instanceof ConflictError && !isSupportedCreate) {
          // Real conflict — capture both sides so a clinician can review,
          // instead of the change silently vanishing or overwriting.
          const serverRecord = await getServerRecordForConflict(upperEntityType, entityId, tenantId);

          const syncQueue = await prisma.syncQueue.create({
            data: {
              deviceId: device.id,
              entityType: upperEntityType,
              entityId,
              operation: operation as any,
              payload: JSON.stringify(payload),
              status: 'CONFLICT',
              conflictDetected: true,
            },
          });

          await prisma.syncConflict.create({
            data: {
              tenantId,
              deviceId: device.id,
              syncQueueId: syncQueue.id,
              entityType: upperEntityType,
              entityId,
              localPayload: payload,
              serverPayload: (serverRecord as any) || {},
              localVersion: baseVersion ?? 0,
              serverVersion: serverRecord?.version ?? 0,
            },
          });

          results.push({ entityId, status: 'CONFLICT', syncQueueId: syncQueue.id });
        } else if (err instanceof NotFoundError) {
          const syncQueue = await prisma.syncQueue.create({
            data: {
              deviceId: device.id,
              entityType: upperEntityType,
              entityId,
              operation: operation as any,
              payload: JSON.stringify(payload),
              status: 'FAILED',
              errorMessage: err.message,
            },
          });
          results.push({ entityId, status: 'ERROR', message: err.message, syncQueueId: syncQueue.id });
        } else {
          logger.error(`Sync push failed for ${upperEntityType} ${entityId}:`, err);
          // Every other error path in this codebase routes through
          // getSafeErrorMessage specifically so raw Prisma errors (e.g. FK
          // constraint names, column names) never reach the client — this
          // branch was the one exception, returning err.message verbatim to
          // any authenticated caller whose sync push hit an unexpected
          // error. The raw message is still kept in errorMessage for the
          // sync-queue record itself (visible to staff reviewing conflicts),
          // just not in the response sent back to the pushing device.
          const safeMessage = getSafeErrorMessage(err, 'Failed to apply this change');
          const syncQueue = await prisma.syncQueue.create({
            data: {
              deviceId: device.id,
              entityType: upperEntityType,
              entityId,
              operation: operation as any,
              payload: JSON.stringify(payload),
              status: 'FAILED',
              errorMessage: err.message,
            },
          });
          results.push({ entityId, status: 'ERROR', message: safeMessage, syncQueueId: syncQueue.id });
        }
      }
    }

    await prisma.syncDevice.update({
      where: { id: device.id },
      data: { lastSyncAt: new Date(), pendingChanges: results.filter((r) => r.status !== 'APPLIED').length },
    });

    return res.json({ success: true, data: results });
  } catch (error: any) {
    logger.error('Error processing sync push:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: 'Failed to process sync push' });
  }
};

async function getServerRecordForConflict(entityType: string, entityId: string, tenantId: string): Promise<{ version: number } | null> {
  switch (entityType) {
    case 'PATIENT':
      return prisma.patient.findFirst({ where: { id: entityId, tenantId } });
    case 'CONSULTATION':
      return prisma.consultation.findFirst({ where: { id: entityId, tenantId } });
    case 'APPOINTMENT':
      return prisma.appointment.findFirst({ where: { id: entityId, tenantId } });
    case 'INVOICE':
      return prisma.invoice.findFirst({ where: { id: entityId, tenantId } });
    default:
      return null;
  }
}

export const getConflicts = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const conflicts = await prisma.syncConflict.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: conflicts });
  } catch (error: any) {
    logger.error('Error fetching sync conflicts:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sync conflicts' });
  }
};

export const resolveConflict = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { resolution } = req.body as { resolution?: 'KEEP_LOCAL' | 'KEEP_SERVER' };

    if (resolution !== 'KEEP_LOCAL' && resolution !== 'KEEP_SERVER') {
      return res.status(400).json({ success: false, message: "resolution must be 'KEEP_LOCAL' or 'KEEP_SERVER'" });
    }

    const conflict = await prisma.syncConflict.findFirst({ where: { id, tenantId } });
    if (!conflict) {
      return res.status(404).json({ success: false, message: 'Conflict not found' });
    }
    if (conflict.status === 'RESOLVED') {
      return res.status(400).json({ success: false, message: 'Conflict has already been resolved' });
    }

    if (resolution === 'KEEP_LOCAL') {
      // Re-check against whatever the server's version is right now — it
      // may have moved again since this conflict was recorded.
      const currentServer = await getServerRecordForConflict(conflict.entityType, conflict.entityId, tenantId);
      if (!currentServer) {
        return res.status(404).json({ success: false, message: 'The server record no longer exists' });
      }

      try {
        await applyUpdate(conflict.entityType, conflict.entityId, conflict.localPayload as Record<string, any>, tenantId, currentServer.version);
      } catch (err: any) {
        if (err instanceof ConflictError) {
          return res.status(409).json({
            success: false,
            message: 'The record changed again since this conflict was recorded — please reload and re-resolve.',
          });
        }
        throw err;
      }
    }
    // KEEP_SERVER requires no write — the server record already reflects
    // what should stand; we just close out the conflict below.

    await prisma.syncConflict.update({
      where: { id },
      data: { status: 'RESOLVED', resolution, resolvedById: userId, resolvedAt: new Date() },
    });

    if (conflict.syncQueueId) {
      await prisma.syncQueue.update({
        where: { id: conflict.syncQueueId },
        data: { status: 'COMPLETED', conflictResolution: resolution, processedAt: new Date() },
      });
    }

    return res.json({ success: true, message: 'Conflict resolved successfully' });
  } catch (error: any) {
    logger.error('Error resolving sync conflict:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: 'Failed to resolve conflict' });
  }
};

export const registerDevice = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { deviceId, deviceName, deviceType } = req.body as { deviceId?: string; deviceName?: string; deviceType?: string };
    if (!deviceId || !deviceName) {
      return res.status(400).json({ success: false, message: 'deviceId and deviceName are required' });
    }

    const device = await prisma.syncDevice.upsert({
      where: { tenantId_deviceId: { tenantId, deviceId } },
      update: { tenantId, deviceName, deviceType: deviceType || 'BROWSER', status: 'ACTIVE' },
      create: {
        tenantId,
        deviceId,
        deviceName,
        deviceType: deviceType || 'BROWSER',
        deviceToken: deviceId, // browser devices authenticate via the user's own session, not a separate device token
        status: 'ACTIVE',
      },
    });

    return res.status(201).json({ success: true, message: 'Device registered', data: device });
  } catch (error: any) {
    logger.error('Error registering sync device:', error);
    return res.status(500).json({ success: false, message: 'Failed to register device' });
  }
};
