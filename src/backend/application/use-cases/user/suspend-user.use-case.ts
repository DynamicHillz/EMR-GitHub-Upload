/**
 * Suspend User Use Case
 * Handles user suspension
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../../config/logger';

export class SuspendUserUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    userId: string,
    suspendedBy: string,
    until?: Date
  ): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.status === 'SUSPENDED') {
        throw new Error('User is already suspended');
      }

      // Update user status
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          status: 'SUSPENDED',
          lockedUntil: until,
        },
      });

      // Revoke all refresh tokens
      await this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      });

      // Log suspension
      await this.prisma.auditLog.create({
        data: {
          userId: suspendedBy,
          tenantId: user.tenantId,
          action: 'USER_SUSPENDED',
          entityType: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            email: user.email,
            suspendedBy,
            suspendedUntil: until?.toISOString(),
            timestamp: new Date().toISOString(),
          }),
        },
      });

      logger.info(
        `User suspended: ${user.email} by ${suspendedBy}${until ? ` until ${until.toISOString()}` : ''}`
      );

      return {
        message: `User suspended successfully${until ? ` until ${until.toLocaleDateString()}` : ''}`,
      };
    } catch (error: any) {
      logger.error('Suspend user error:', error);
      throw error;
    }
  }
}
