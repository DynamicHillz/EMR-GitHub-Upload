/**
 * Audit & Archive Controller
 * Handles fetching audit logs and soft-deleted records for Super Admins
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';

const prisma = new PrismaClient();

// Config-driven archive/restore dispatch — was a hardcoded switch duplicated
// across getArchivedRecords and restoreRecord, covering only 3 of the ~24
// soft-deletable models in the schema. Adding coverage for a new entity type
// is now a one-line addition here instead of two new switch cases. Scoped to
// entity types worth an admin recovering by hand (accidental-deletion
// recovery), not an exhaustive list of every soft-deletable model.
const ARCHIVE_ENTITIES: Record<string, {
  findMany: (tenantId: string) => Promise<any[]>;
  restore: (tenantId: string, id: string) => Promise<{ count: number }>;
}> = {
  patients: {
    findMany: (tenantId) => prisma.patient.findMany({
      where: { tenantId, isDeleted: true } as any,
      orderBy: { deletedAt: 'desc' } as any,
    }),
    restore: (tenantId, id) => prisma.patient.updateMany({
      where: { id, tenantId, isDeleted: true } as any,
      data: { isDeleted: false, deletedAt: null, deletedBy: null } as any,
    }),
  },
  appointments: {
    findMany: (tenantId) => prisma.appointment.findMany({
      where: { tenantId, isDeleted: true },
      orderBy: { deletedAt: 'desc' },
      include: { patient: { select: { firstName: true, lastName: true } } },
    }),
    restore: (tenantId, id) => prisma.appointment.updateMany({
      where: { id, tenantId, isDeleted: true },
      data: { isDeleted: false, deletedAt: null, deletedBy: null },
    }),
  },
  consultations: {
    findMany: (tenantId) => prisma.consultation.findMany({
      where: { tenantId, isDeleted: true },
      orderBy: { deletedAt: 'desc' },
      include: { patient: { select: { firstName: true, lastName: true } } },
    }),
    restore: (tenantId, id) => prisma.consultation.updateMany({
      where: { id, tenantId, isDeleted: true },
      data: { isDeleted: false, deletedAt: null, deletedBy: null },
    }),
  },
  prescriptions: {
    findMany: (tenantId) => prisma.prescription.findMany({
      where: { tenantId, isDeleted: true },
      orderBy: { deletedAt: 'desc' },
      include: { patient: { select: { firstName: true, lastName: true } } },
    }),
    restore: (tenantId, id) => prisma.prescription.updateMany({
      where: { id, tenantId, isDeleted: true },
      data: { isDeleted: false, deletedAt: null, deletedBy: null },
    }),
  },
  invoices: {
    findMany: (tenantId) => prisma.invoice.findMany({
      where: { tenantId, isDeleted: true } as any,
      orderBy: { deletedAt: 'desc' } as any,
      include: { patient: { select: { firstName: true, lastName: true } } },
    }),
    restore: (tenantId, id) => prisma.invoice.updateMany({
      where: { id, tenantId, isDeleted: true } as any,
      data: { isDeleted: false, deletedAt: null, deletedBy: null } as any,
    }),
  },
  payments: {
    findMany: (tenantId) => prisma.payment.findMany({
      where: { tenantId, isDeleted: true } as any,
      orderBy: { deletedAt: 'desc' } as any,
      include: { patient: { select: { firstName: true, lastName: true } } },
    }),
    restore: (tenantId, id) => prisma.payment.updateMany({
      where: { id, tenantId, isDeleted: true } as any,
      data: { isDeleted: false, deletedAt: null, deletedBy: null } as any,
    }),
  },
};

export class AuditController {
  
  /**
   * Get all action audit logs
   * GET /api/audit/logs
   */
  async getAuditLogs(req: Request, res: Response) {
    try {
      const { tenantId } = req.user!;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const entityType = req.query.entityType as string;
      const action = req.query.action as string;
      const search = req.query.search as string;

      const where: any = { tenantId };

      if (startDate && endDate) {
        where.timestamp = {
          gte: new Date(startDate),
          lte: new Date(endDate),
        };
      } else if (startDate) {
        where.timestamp = { gte: new Date(startDate) };
      } else if (endDate) {
        where.timestamp = { lte: new Date(endDate) };
      }

      if (entityType) {
        where.entityType = entityType;
      }

      if (action) {
        where.action = action;
      }

      if (search) {
        // Search across userId, action, entityId, etc.
        where.OR = [
          { userId: { contains: search, mode: 'insensitive' } },
          { action: { contains: search, mode: 'insensitive' } },
          { entityId: { contains: search, mode: 'insensitive' } },
          { entityType: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [rawLogs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: limit,
          include: { user: { select: { firstName: true, lastName: true } } }
        }),
        prisma.auditLog.count({ where }),
      ]);

      const patientIds = rawLogs.filter(l => l.entityType.includes('PATIENT')).map(l => l.entityId).filter(Boolean) as string[];
      const userIds = rawLogs.filter(l => l.entityType.includes('USER')).map(l => l.entityId).filter(Boolean) as string[];

      const [patients, users] = await Promise.all([
        patientIds.length > 0 ? prisma.patient.findMany({ where: { id: { in: patientIds } }, select: { id: true, firstName: true, lastName: true, patientId: true } }) : [],
        userIds.length > 0 ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } }) : []
      ]);

      const patientMap = new Map(patients.map(p => [p.id, `${p.firstName} ${p.lastName} (${p.patientId})`]));
      const userMap = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

      const logs = rawLogs.map(log => {
        let entityName = log.entityId || 'Unknown ID';
        if (log.entityType.includes('PATIENT') && log.entityId && patientMap.has(log.entityId)) {
          entityName = patientMap.get(log.entityId)!;
        } else if (log.entityType.includes('USER') && log.entityId && userMap.has(log.entityId)) {
          entityName = userMap.get(log.entityId)!;
        }

        return {
          ...log,
          entityName,
          userName: log.user ? `${log.user.firstName} ${log.user.lastName}` : (log.userId || 'System')
        };
      });

      res.status(200).json({
        success: true,
        data: {
          logs,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      logger.error('Failed to fetch audit logs:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
    }
  }

  /**
   * Get all soft-deleted records for a specific entity type
   * GET /api/audit/archive/:entityType
   */
  async getArchivedRecords(req: Request, res: Response) {
    try {
      const { tenantId } = req.user!;
      const { entityType } = req.params;

      const entity = ARCHIVE_ENTITIES[entityType.toLowerCase()];
      if (!entity) {
        return res.status(400).json({ success: false, message: 'Invalid entity type for archive' });
      }

      const records = await entity.findMany(tenantId);

      res.status(200).json({
        success: true,
        data: records,
      });
    } catch (error: any) {
      logger.error(`Failed to fetch archive for ${req.params.entityType}:`, error);
      res.status(500).json({ success: false, message: `Failed to fetch archived ${req.params.entityType}` });
    }
  }

  /**
   * Restore a soft-deleted record
   * POST /api/audit/archive/:entityType/:id/restore
   */
  async restoreRecord(req: Request, res: Response) {
    try {
      const { tenantId, id: userId } = req.user!;
      const { entityType, id } = req.params;

      const entity = ARCHIVE_ENTITIES[entityType.toLowerCase()];
      if (!entity) {
        return res.status(400).json({ success: false, message: 'Invalid entity type for restore' });
      }

      const restoredRecord = await entity.restore(tenantId, id);

      if (restoredRecord.count === 0) {
        return res.status(404).json({ success: false, message: 'Record not found or not deleted' });
      }

      // Log the restoration
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'RESTORE',
          entityType: entityType.toUpperCase(),
          entityId: id,
          metadata: JSON.stringify({ timestamp: new Date().toISOString() }),
        },
      });

      res.status(200).json({
        success: true,
        message: `${entityType} restored successfully`,
      });
    } catch (error: any) {
      logger.error(`Failed to restore ${req.params.entityType} with ID ${req.params.id}:`, error);
      res.status(500).json({ success: false, message: `Failed to restore ${req.params.entityType}` });
    }
  }
}

export const auditController = new AuditController();
