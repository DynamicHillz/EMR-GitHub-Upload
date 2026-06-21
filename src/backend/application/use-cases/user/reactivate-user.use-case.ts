/**
 * Reactivate User Use Case
 * Handles user reactivation
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../../config/logger';

export class ReactivateUserUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(userId: string, reactivatedBy: string): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.status === 'ACTIVE') {
        throw new Error('User is already active');
      }

      // Update user status
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          status: 'ACTIVE',
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Log reactivation
      await this.prisma.auditLog.create({
        data: {
          userId: reactivatedBy,
          tenantId: user.tenantId,
          action: 'USER_REACTIVATED',
          entityType: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            email: user.email,
            previousStatus: user.status,
            reactivatedBy,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      logger.info(`User reactivated: ${user.email} by ${reactivatedBy}`);

      return { message: 'User reactivated successfully' };
    } catch (error: any) {
      logger.error('Reactivate user error:', error);
      throw error;
    }
  }
}
