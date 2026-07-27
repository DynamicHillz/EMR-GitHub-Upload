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
  for (const hours of [24, 2]) {
    const appointments = await appointmentRepository.findNeedingReminder(hours);

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
