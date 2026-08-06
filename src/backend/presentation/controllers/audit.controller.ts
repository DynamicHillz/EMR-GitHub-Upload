/**
 * Audit & Archive Controller
 * Handles fetching audit logs and soft-deleted records for Super Admins
 */

import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { prisma } from '../../infrastructure/database/prisma.client';

// A search for a person's full name as displayed in the UI ("Jane Doe")
// must match even though firstName/lastName are separate columns — a plain
// `contains` on either field alone never matches the space-joined full
// string ("Doe" contains "Jane Doe"? no; "Jane" contains "Jane Doe"? no).
// Splits on whitespace and additionally checks first-word+rest against
// firstName+lastName in both orders, so "Jane Doe" and "Doe Jane" both work
// alongside a plain single-word search.
function nameSearchConditions(search: string): any[] {
  const conditions: any[] = [
    { firstName: { contains: search, mode: 'insensitive' } },
    { lastName: { contains: search, mode: 'insensitive' } },
  ];
  const words = search.trim().split(/\s+/);
  if (words.length > 1) {
    const first = words[0];
    const rest = words.slice(1).join(' ');
    conditions.push(
      { AND: [{ firstName: { contains: first, mode: 'insensitive' } }, { lastName: { contains: rest, mode: 'insensitive' } }] },
      { AND: [{ lastName: { contains: first, mode: 'insensitive' } }, { firstName: { contains: rest, mode: 'insensitive' } }] },
    );
  }
  return conditions;
}

// Config-driven entity-name resolution for the Audit Log's "Entity" column —
// previously only PATIENT and USER were ever resolved to a real name; every
// other entity type (invoice, payment, refund, appointment, ward, etc.)
// showed the raw UUID, which means nothing to a human reviewing the log.
// Mirrors the ARCHIVE_ENTITIES config-driven pattern just below: adding a
// new entity type is a one-line addition here, not a new branch in the
// mapping loop. Keyed by the exact AuditLog.entityType string (not a
// substring match — 'PATIENT_INSURANCE'.includes('PATIENT') would otherwise
// wrongly route a policy id into the Patient resolver).
const ENTITY_NAME_RESOLVERS: Record<string, (ids: string[], tenantId: string) => Promise<Map<string, string>>> = {
  PATIENT: async (ids, tenantId) => {
    const rows = await prisma.patient.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, firstName: true, lastName: true, patientId: true } });
    return new Map(rows.map(p => [p.id, `${p.firstName} ${p.lastName} (${p.patientId})`]));
  },
  USER: async (ids, tenantId) => {
    const rows = await prisma.user.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, firstName: true, lastName: true } });
    return new Map(rows.map(u => [u.id, `${u.firstName} ${u.lastName}`]));
  },
  INVOICE: async (ids, tenantId) => {
    const rows = await prisma.invoice.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, invoiceNumber: true, patient: { select: { firstName: true, lastName: true } } } });
    return new Map(rows.map(i => [i.id, `Invoice ${i.invoiceNumber} — ${i.patient.firstName} ${i.patient.lastName}`]));
  },
  PAYMENT: async (ids, tenantId) => {
    const rows = await prisma.payment.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, paymentNumber: true, patient: { select: { firstName: true, lastName: true } } } });
    return new Map(rows.map(p => [p.id, `Payment ${p.paymentNumber} — ${p.patient.firstName} ${p.patient.lastName}`]));
  },
  REFUND: async (ids, tenantId) => {
    const rows = await prisma.refund.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, refundNumber: true, patient: { select: { firstName: true, lastName: true } } } });
    return new Map(rows.map(r => [r.id, `Refund ${r.refundNumber} — ${r.patient.firstName} ${r.patient.lastName}`]));
  },
  APPOINTMENT: async (ids, tenantId) => {
    const rows = await prisma.appointment.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, appointmentDate: true, patient: { select: { firstName: true, lastName: true } } } });
    return new Map(rows.map(a => [a.id, `Appointment — ${a.patient.firstName} ${a.patient.lastName} (${a.appointmentDate.toISOString().split('T')[0]})`]));
  },
  CONSULTATION: async (ids, tenantId) => {
    const rows = await prisma.consultation.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, patient: { select: { firstName: true, lastName: true } } } });
    return new Map(rows.map(c => [c.id, `Consultation — ${c.patient.firstName} ${c.patient.lastName}`]));
  },
  PRESCRIPTION: async (ids, tenantId) => {
    const rows = await prisma.prescription.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, medicationName: true, patient: { select: { firstName: true, lastName: true } } } });
    return new Map(rows.map(p => [p.id, `${p.medicationName} — ${p.patient.firstName} ${p.patient.lastName}`]));
  },
  MEDICATION: async (ids, tenantId) => {
    const rows = await prisma.medication.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true } });
    return new Map(rows.map(m => [m.id, m.name]));
  },
  WARD: async (ids, tenantId) => {
    const rows = await prisma.ward.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true } });
    return new Map(rows.map(w => [w.id, w.name]));
  },
  INSURANCE_PROVIDER: async (ids, tenantId) => {
    const rows = await prisma.insuranceProvider.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, name: true } });
    return new Map(rows.map(p => [p.id, p.name]));
  },
  INSURANCE_CLAIM: async (ids, tenantId) => {
    const rows = await prisma.insuranceClaim.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, invoice: { select: { invoiceNumber: true } } } });
    return new Map(rows.map(c => [c.id, `Claim for Invoice ${c.invoice.invoiceNumber}`]));
  },
  PATIENT_INSURANCE: async (ids, tenantId) => {
    const rows = await prisma.patientInsurance.findMany({ where: { id: { in: ids }, tenantId }, select: { id: true, policyNumber: true, patient: { select: { firstName: true, lastName: true } } } });
    return new Map(rows.map(p => [p.id, `Policy ${p.policyNumber} — ${p.patient.firstName} ${p.patient.lastName}`]));
  },
};

// Config-driven archive/restore dispatch — was a hardcoded switch duplicated
// across getArchivedRecords and restoreRecord, covering only 3 of the ~24
// soft-deletable models in the schema. Adding coverage for a new entity type
// is now a one-line addition here instead of two new switch cases. Scoped to
// entity types worth an admin recovering by hand (accidental-deletion
// recovery), not an exhaustive list of every soft-deletable model.
const ARCHIVE_ENTITIES: Record<string, {
  findMany: (tenantId: string, skip: number, take: number, sinceDate: Date) => Promise<any[]>;
  count: (tenantId: string, sinceDate: Date) => Promise<number>;
  restore: (tenantId: string, id: string) => Promise<{ count: number }>;
}> = {
  patients: {
    findMany: (tenantId, skip, take, sinceDate) => prisma.patient.findMany({
      where: { tenantId, isDeleted: true, deletedAt: { gte: sinceDate } } as any,
      orderBy: { deletedAt: 'desc' } as any,
      skip,
      take,
    }),
    count: (tenantId, sinceDate) => prisma.patient.count({ where: { tenantId, isDeleted: true, deletedAt: { gte: sinceDate } } as any }),
    restore: (tenantId, id) => prisma.patient.updateMany({
      where: { id, tenantId, isDeleted: true } as any,
      data: { isDeleted: false, deletedAt: null, deletedBy: null } as any,
    }),
  },
  appointments: {
    findMany: (tenantId, skip, take, sinceDate) => prisma.appointment.findMany({
      where: { tenantId, isDeleted: true, deletedAt: { gte: sinceDate } },
      orderBy: { deletedAt: 'desc' },
      skip,
      take,
      include: { patient: { select: { firstName: true, lastName: true } } },
    }),
    count: (tenantId, sinceDate) => prisma.appointment.count({ where: { tenantId, isDeleted: true, deletedAt: { gte: sinceDate } } }),
    restore: (tenantId, id) => prisma.appointment.updateMany({
      where: { id, tenantId, isDeleted: true },
      data: { isDeleted: false, deletedAt: null, deletedBy: null },
    }),
  },
  consultations: {
    findMany: (tenantId, skip, take, sinceDate) => prisma.consultation.findMany({
      where: { tenantId, isDeleted: true, deletedAt: { gte: sinceDate } },
      orderBy: { deletedAt: 'desc' },
      skip,
      take,
      include: { patient: { select: { firstName: true, lastName: true } } },
    }),
    count: (tenantId, sinceDate) => prisma.consultation.count({ where: { tenantId, isDeleted: true, deletedAt: { gte: sinceDate } } }),
    restore: (tenantId, id) => prisma.consultation.updateMany({
      where: { id, tenantId, isDeleted: true },
      data: { isDeleted: false, deletedAt: null, deletedBy: null },
    }),
  },
  prescriptions: {
    findMany: (tenantId, skip, take, sinceDate) => prisma.prescription.findMany({
      where: { tenantId, isDeleted: true, deletedAt: { gte: sinceDate } },
      orderBy: { deletedAt: 'desc' },
      skip,
      take,
      include: { patient: { select: { firstName: true, lastName: true } } },
    }),
    count: (tenantId, sinceDate) => prisma.prescription.count({ where: { tenantId, isDeleted: true, deletedAt: { gte: sinceDate } } }),
    restore: (tenantId, id) => prisma.prescription.updateMany({
      where: { id, tenantId, isDeleted: true },
      data: { isDeleted: false, deletedAt: null, deletedBy: null },
    }),
  },
  invoices: {
    findMany: (tenantId, skip, take, sinceDate) => prisma.invoice.findMany({
      where: { tenantId, isDeleted: true, deletedAt: { gte: sinceDate } } as any,
      orderBy: { deletedAt: 'desc' } as any,
      skip,
      take,
      include: { patient: { select: { firstName: true, lastName: true } } },
    }),
    count: (tenantId, sinceDate) => prisma.invoice.count({ where: { tenantId, isDeleted: true, deletedAt: { gte: sinceDate } } as any }),
    restore: (tenantId, id) => prisma.invoice.updateMany({
      where: { id, tenantId, isDeleted: true } as any,
      data: { isDeleted: false, deletedAt: null, deletedBy: null } as any,
    }),
  },
  payments: {
    findMany: (tenantId, skip, take, sinceDate) => prisma.payment.findMany({
      where: { tenantId, isDeleted: true, deletedAt: { gte: sinceDate } } as any,
      orderBy: { deletedAt: 'desc' } as any,
      skip,
      take,
      include: { patient: { select: { firstName: true, lastName: true } } },
    }),
    count: (tenantId, sinceDate) => prisma.payment.count({ where: { tenantId, isDeleted: true, deletedAt: { gte: sinceDate } } as any }),
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
      } else if (search) {
        // The free-text `search` OR-clause includes an unindexed `metadata
        // contains` check — bounded date-range queries stay fast via the
        // trigram indexes on action/entityType, but metadata has none (see
        // the schema comment). Default to the last 90 days so that scan
        // stays bounded regardless of how large audit_logs has grown; an
        // explicit startDate/endDate above still overrides this.
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        where.timestamp = { gte: ninetyDaysAgo };
      }

      if (entityType) {
        where.entityType = entityType;
      }

      if (action) {
        where.action = action;
      }

      if (search) {
        // Raw-field search alone only ever matched a UUID typed verbatim —
        // useless in practice, since the UI shows resolved names (userName/
        // entityName), not raw ids, so there was no way to actually discover
        // those ids to search for. Resolve name matches for the two entity
        // types the response already displays names for (patients and
        // users) — entityId has no fixed Prisma relation to join against
        // directly (it's polymorphic across patients/invoices/appointments/
        // etc.), so this is a best-effort secondary lookup, not a single
        // nested-relation filter the way the *performing* user's name below
        // can be.
        const [matchingPatientIds, matchingUserIds] = await Promise.all([
          prisma.patient.findMany({
            where: {
              tenantId,
              OR: [...nameSearchConditions(search), { patientId: { contains: search, mode: 'insensitive' } }],
            },
            select: { id: true },
          }),
          prisma.user.findMany({
            where: { tenantId, OR: nameSearchConditions(search) },
            select: { id: true },
          }),
        ]);
        const matchingEntityIds = [...matchingPatientIds, ...matchingUserIds].map((r) => r.id);

        where.OR = [
          { userId: { contains: search, mode: 'insensitive' } },
          { action: { contains: search, mode: 'insensitive' } },
          { entityId: { contains: search, mode: 'insensitive' } },
          { entityType: { contains: search, mode: 'insensitive' } },
          // metadata carries real searchable detail (e.g. a failed login's
          // attempted email/reason) that was previously invisible to search.
          { metadata: { contains: search, mode: 'insensitive' } },
          // The user who PERFORMED the action — a real relation, so this can
          // be a direct nested filter.
          { user: { OR: nameSearchConditions(search) } },
          ...(matchingEntityIds.length > 0 ? [{ entityId: { in: matchingEntityIds } }] : []),
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

      // Group each row's entityId by its exact entityType so every type with
      // a resolver gets one batched lookup instead of a per-row query.
      const idsByType = new Map<string, Set<string>>();
      for (const log of rawLogs) {
        if (!log.entityId || !ENTITY_NAME_RESOLVERS[log.entityType]) continue;
        const set = idsByType.get(log.entityType) || new Set<string>();
        set.add(log.entityId);
        idsByType.set(log.entityType, set);
      }

      const nameMapsByType = new Map<string, Map<string, string>>();
      await Promise.all(
        Array.from(idsByType.entries()).map(async ([type, ids]) => {
          nameMapsByType.set(type, await ENTITY_NAME_RESOLVERS[type](Array.from(ids), tenantId));
        })
      );

      const logs = rawLogs.map(log => {
        // null (not a placeholder string like 'Unknown ID') — a null entityId
        // is overwhelmingly a genuine list-view GET (e.g. GET /billing/invoices,
        // no single record involved), not evidence something failed to
        // capture. Labeling that "Unknown ID" reads as a bug when it isn't
        // one; the frontend renders a neutral dash instead. When there IS an
        // entityId but no resolver matched anything (e.g. the record was
        // since deleted, or its type has no resolver yet), fall back to the
        // raw id rather than showing nothing.
        const resolved = log.entityId ? nameMapsByType.get(log.entityType)?.get(log.entityId) : undefined;
        const entityName: string | null = resolved ?? log.entityId ?? null;

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
   * Get the full InvoiceAuditLog trail for one invoice — richer detail
   * (previous/new values, notes) than the generic AuditLog entry the
   * auditRequest middleware writes for the same event, but never surfaced
   * anywhere until now. Fetched on-demand from the Audit Log UI's Details
   * modal rather than merged into the main paginated list.
   * GET /api/audit/invoice-logs/:invoiceId
   */
  async getInvoiceAuditTrail(req: Request, res: Response) {
    try {
      const { tenantId } = req.user!;
      const { invoiceId } = req.params;

      const logs = await prisma.invoiceAuditLog.findMany({
        where: { tenantId, invoiceId },
        orderBy: { createdAt: 'asc' },
      });

      res.status(200).json({ success: true, data: logs });
    } catch (error: any) {
      logger.error(`Failed to fetch invoice audit trail for ${req.params.invoiceId}:`, error);
      res.status(500).json({ success: false, message: 'Failed to fetch invoice audit trail' });
    }
  }

  /**
   * Get the full PaymentAuditLog trail for one payment — same reasoning as
   * getInvoiceAuditTrail above, but for fraud-prevention detail (flag
   * reasons, approver names) captured on payments.
   * GET /api/audit/payment-logs/:paymentId
   */
  async getPaymentAuditTrail(req: Request, res: Response) {
    try {
      const { tenantId } = req.user!;
      const { paymentId } = req.params;

      const logs = await prisma.paymentAuditLog.findMany({
        where: { tenantId, paymentId },
        orderBy: { createdAt: 'asc' },
      });

      res.status(200).json({ success: true, data: logs });
    } catch (error: any) {
      logger.error(`Failed to fetch payment audit trail for ${req.params.paymentId}:`, error);
      res.status(500).json({ success: false, message: 'Failed to fetch payment audit trail' });
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

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      // Default to the last 90 days so an old, fully-handled deletion isn't
      // fetched on every archive-tab open, years into a clinic's history.
      // An admin looking for something older can pass ?sinceDate= to widen
      // (or explicitly re-narrow) the window.
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const sinceDate = req.query.sinceDate ? new Date(req.query.sinceDate as string) : ninetyDaysAgo;

      const [records, total] = await Promise.all([
        entity.findMany(tenantId, skip, limit, sinceDate),
        entity.count(tenantId, sinceDate),
      ]);

      res.status(200).json({
        success: true,
        data: records,
        total,
        page,
        totalPages: Math.ceil(total / limit),
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
