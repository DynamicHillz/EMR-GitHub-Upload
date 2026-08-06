/**
 * Notification Controller
 *
 * Every authenticated user reads only their own notifications, filtered by
 * userId from the JWT — there is no cross-user access here.
 */

import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { prisma } from '../../infrastructure/database/prisma.client';

export class NotificationController {
  /**
   * GET /api/notifications
   * ?unreadOnly=true&limit=20
   */
  async getMyNotifications(req: Request, res: Response) {
    try {
      const { tenantId, id: userId } = req.user!;
      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = parseInt(req.query.limit as string) || 20;
      const severity = req.query.severity as string | undefined;

      const notifications = await prisma.notification.findMany({
        where: {
          tenantId,
          userId,
          ...(unreadOnly ? { isRead: false } : {}),
          ...(severity ? { severity: severity as any } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return res.json({ success: true, data: notifications });
    } catch (error: any) {
      logger.error('Error fetching notifications:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
  }

  /**
   * GET /api/notifications/unread-count
   */
  async getUnreadCount(req: Request, res: Response) {
    try {
      const { tenantId, id: userId } = req.user!;
      // needsAcknowledgment counts CRITICAL notifications not yet
      // acknowledged — distinct from isRead, since viewing a CRITICAL alert
      // in the dropdown doesn't count as confirming action was taken on it.
      const needsAcknowledgment = req.query.needsAcknowledgment === 'true';
      const count = await prisma.notification.count({
        where: needsAcknowledgment
          ? { tenantId, userId, severity: 'CRITICAL', acknowledgedById: null }
          : { tenantId, userId, isRead: false },
      });
      return res.json({ success: true, count });
    } catch (error: any) {
      logger.error('Error fetching unread notification count:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   */
  async markRead(req: Request, res: Response) {
    try {
      const { tenantId, id: userId } = req.user!;
      const { id } = req.params;

      const notification = await prisma.notification.findFirst({ where: { id, tenantId, userId } });
      if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
      });

      return res.json({ success: true, data: updated });
    } catch (error: any) {
      logger.error('Error marking notification as read:', error);
      return res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
    }
  }

  /**
   * PATCH /api/notifications/:id/acknowledge
   *
   * Distinct from mark-read — confirms a clinician is acting on a CRITICAL
   * alert, not just that they've seen it in the list.
   */
  async acknowledge(req: Request, res: Response) {
    try {
      const { tenantId, id: userId } = req.user!;
      const { id } = req.params;

      const notification = await prisma.notification.findFirst({ where: { id, tenantId, userId } });
      if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { acknowledgedById: userId, acknowledgedAt: new Date(), isRead: true, readAt: new Date() },
      });

      return res.json({ success: true, data: updated });
    } catch (error: any) {
      logger.error('Error acknowledging notification:', error);
      return res.status(500).json({ success: false, message: 'Failed to acknowledge notification' });
    }
  }

  /**
   * PATCH /api/notifications/read-all
   */
  async markAllRead(req: Request, res: Response) {
    try {
      const { tenantId, id: userId } = req.user!;
      await prisma.notification.updateMany({
        where: { tenantId, userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('Error marking all notifications as read:', error);
      return res.status(500).json({ success: false, message: 'Failed to mark notifications as read' });
    }
  }
}

export const notificationController = new NotificationController();
