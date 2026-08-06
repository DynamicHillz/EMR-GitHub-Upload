/**
 * Notification Service
 *
 * Small reusable helper for creating in-app notifications. Any use-case that
 * detects something a staff member should act on (a critical lab result, a
 * new stock alert, etc.) calls this instead of inventing its own delivery
 * mechanism.
 */

import { PrismaClient } from '@prisma/client';
import type { UserRole, NotificationSeverity } from '../../shared/types/prisma-enums';

export interface NotifyInput {
  type: string;
  // Omitting this defers to the Prisma column default (WARNING) — every
  // call site should still set it explicitly rather than rely on that,
  // since severity drives visual triage and CRITICAL's acknowledgment
  // requirement in NotificationBell.tsx.
  severity?: NotificationSeverity;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  async notify(tenantId: string, userId: string, input: NotifyInput) {
    return this.prisma.notification.create({
      data: {
        tenantId,
        userId,
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: input.message,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });
  }

  async notifyRole(tenantId: string, roles: UserRole[], input: NotifyInput) {
    const recipients = await this.prisma.user.findMany({
      where: { tenantId, role: { in: roles }, isDeleted: false },
      select: { id: true },
    });

    if (recipients.length === 0) return;

    await this.prisma.notification.createMany({
      data: recipients.map((user) => ({
        tenantId,
        userId: user.id,
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: input.message,
        entityType: input.entityType,
        entityId: input.entityId,
      })),
    });
  }

  // For alerts that can keep re-firing about the same ongoing situation
  // (a repeated abnormal vital-sign reading, a partograph alert checked
  // every few minutes) rather than a discrete one-off clinical event. Skips
  // creating anything if a notification with the same tenantId+type+entityId
  // was already created within the cooldown window — a fresh reading with
  // no material change carries no new information, and firing on every one
  // would flood the recipients' notification list. Requires a real entityId
  // (the dedup key); a call site with no natural entity to key on shouldn't
  // use this method at all, since without one every call would just look
  // like a fresh alert.
  async notifyRoleWithCooldown(tenantId: string, roles: UserRole[], input: NotifyInput & { entityId: string }, cooldownMinutes: number) {
    const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);
    const recent = await this.prisma.notification.findFirst({
      where: {
        tenantId,
        type: input.type,
        entityId: input.entityId,
        createdAt: { gte: cutoff },
      },
      select: { id: true },
    });

    if (recent) return;

    await this.notifyRole(tenantId, roles, input);
  }

  // Distinct from mark-read — a clinician confirming they're acting on a
  // CRITICAL alert, not just having seen it in the list.
  async acknowledge(tenantId: string, userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, tenantId, userId },
      data: { acknowledgedById: userId, acknowledgedAt: new Date(), isRead: true, readAt: new Date() },
    });
  }
}
