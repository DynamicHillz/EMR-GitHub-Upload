/**
 * Deactivate User Use Case
 * Handles user deactivation
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../../config/logger';

export class DeactivateUserUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(userId: string, deactivatedBy: string): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.status === 'INACTIVE') {
        throw new Error('User is already deactivated');
      }

      // Update user status
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: 'INACTIVE' },
      });

      // Revoke all refresh tokens
      await this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      });

      // Log deactivation
      await this.prisma.auditLog.create({
        data: {
          userId: deactivatedBy,
          tenantId: user.tenantId,
          action: 'USER_DEACTIVATED',
          entityType: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            email: user.email,
            deactivatedBy,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      logger.info(`User deactivated: ${user.email} by ${deactivatedBy}`);

      return { message: 'User deactivated successfully' };
    } catch (error: any) {
      logger.error('Deactivate user error:', error);
      throw error;
    }
  }
}
