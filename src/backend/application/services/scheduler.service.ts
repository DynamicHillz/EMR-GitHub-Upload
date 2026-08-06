/**
 * Scheduler Service
 *
 * Activates two features that already exist in full but never ran on any
 * schedule: SMS appointment reminders (24h/2h) and pharmacy stock/expiry
 * alerts. A simple setInterval/reentrancy-guard shape — this codebase has
 * no cron library installed and no other precedent for a background job.
 */

import { prisma } from '../../infrastructure/database/prisma.client';
import { schedulerPrisma } from '../../infrastructure/database/scheduler-prisma.client';
import { logger } from '../../config/logger';
import { AppointmentRepository } from '../../infrastructure/database/repositories/appointment.repository';
import { SmsService } from '../../infrastructure/external/sms.service';
import { GenerateStockAlertsUseCase } from '../use-cases/pharmacy/generate-stock-alerts.use-case';

const SCHEDULER_INTERVAL = process.env.SCHEDULER_INTERVAL_MS
  ? parseInt(process.env.SCHEDULER_INTERVAL_MS, 10)
  : 15 * 60 * 1000; // 15 minutes

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

const appointmentRepository = new AppointmentRepository(prisma);
const smsService = new SmsService();
// Uses the bounded-pool scheduler client (not the shared singleton) — see
// scheduler-prisma.client.ts for why.
const generateStockAlertsUseCase = new GenerateStockAlertsUseCase(schedulerPrisma);

export const startScheduler = () => {
  logger.info(`Scheduler: Starting with interval ${SCHEDULER_INTERVAL}ms`);

  schedulerInterval = setInterval(async () => {
    if (isRunning) return;

    try {
      isRunning = true;
      await runAppointmentReminders();
      await runStockAlerts();
      await runRetentionPrune();
    } catch (error) {
      logger.error('Scheduler: Unhandled error in scheduled job', error);
    } finally {
      isRunning = false;
    }
  }, SCHEDULER_INTERVAL);
};

export const stopScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Scheduler: Stopped');
  }
};

const runAppointmentReminders = async () => {
  // Looped per-tenant like runStockAlerts below — findNeedingReminder used to
  // have no tenantId filter at all, scanning every tenant's appointments in
  // one query.
  const tenants = await prisma.tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });

  for (const tenant of tenants) {
    for (const hours of [24, 2]) {
      try {
        const appointments = await appointmentRepository.findNeedingReminder(hours, tenant.id);

        for (const appointment of appointments) {
          if (!appointment.patient?.phone) continue;

          const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
          const result = await smsService.sendAppointmentReminder(
            appointment.patient.phone,
            patientName,
            appointment.appointmentDate,
            appointment.tenantId
          );

          if (result.success) {
            await appointmentRepository.markReminderSent(appointment.id, hours);
          } else {
            logger.error(`Scheduler: Failed to send ${hours}h reminder for appointment ${appointment.id}: ${result.error}`);
          }
        }
      } catch (error) {
        logger.error(`Scheduler: Failed to process ${hours}h appointment reminders for tenant ${tenant.id}`, error);
      }
    }
  }
};

const runStockAlerts = async () => {
  const tenants = await prisma.tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });

  for (const tenant of tenants) {
    try {
      await generateStockAlertsUseCase.execute(tenant.id);
    } catch (error) {
      logger.error(`Scheduler: Failed to generate stock alerts for tenant ${tenant.id}`, error);
    }
  }
};

// Retention/purge for pure operational bookkeeping tables only — NOT
// AuditLog (7-year NDPR-oriented compliance retention) and NOT any
// soft-deleted patient/clinical row (real legal weight). SyncQueue,
// SyncConflict, and a read Notification carry no compliance requirement:
// deleting an already-synced queue entry or an already-resolved conflict
// has no legal implication, unlike deleting a patient record or an audit
// trail entry. Constants declared here (not env-configurable) so a clinic
// can tune them later without touching logic, matching
// backup-database.js's RETENTION_DAYS convention.
const SYNC_QUEUE_RETENTION_DAYS = 30;
const SYNC_CONFLICT_RETENTION_DAYS = 90;
const NOTIFICATION_RETENTION_DAYS = 180;

const runRetentionPrune = async () => {
  // SyncQueue has no tenantId field (only deviceId) — pruned globally by
  // age, unlike the two per-tenant prunes below.
  try {
    const cutoff = new Date(Date.now() - SYNC_QUEUE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.syncQueue.deleteMany({
      where: { status: 'COMPLETED', processedAt: { lt: cutoff } },
    });
  } catch (error) {
    logger.error('Scheduler: Failed to prune SyncQueue', error);
  }

  const tenants = await prisma.tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });

  for (const tenant of tenants) {
    try {
      const cutoff = new Date(Date.now() - SYNC_CONFLICT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await prisma.syncConflict.deleteMany({
        where: { tenantId: tenant.id, status: 'RESOLVED', resolvedAt: { lt: cutoff } },
      });
    } catch (error) {
      logger.error(`Scheduler: Failed to prune SyncConflict for tenant ${tenant.id}`, error);
    }

    try {
      const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await prisma.notification.deleteMany({
        where: { tenantId: tenant.id, isRead: true, readAt: { lt: cutoff } },
      });
    } catch (error) {
      logger.error(`Scheduler: Failed to prune Notification for tenant ${tenant.id}`, error);
    }
  }
};
