/**
 * Notification Service
 *
 * Small reusable helper for creating in-app notifications. Any use-case that
 * detects something a staff member should act on (a critical lab result, a
 * new stock alert, etc.) calls this instead of inventing its own delivery
 * mechanism.
 */

import { PrismaClient } from '@prisma/client';
import type { UserRole } from '../../shared/types/prisma-enums';

export interface NotifyInput {
  type: string;
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
        title: input.title,
        message: input.message,
        entityType: input.entityType,
        entityId: input.entityId,
      })),
    });
  }
}
