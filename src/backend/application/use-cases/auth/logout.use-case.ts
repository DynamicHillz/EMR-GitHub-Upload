/**
 * Logout Use Case
 * Handles user logout and token revocation
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../../config/logger';

export class LogoutUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(userId: string, refreshToken?: string, requestMeta?: { ipAddress?: string; userAgent?: string }): Promise<{ message: string }> {
    try {
      // If refresh token provided, revoke it
      if (refreshToken) {
        await this.prisma.refreshToken.updateMany({
          where: {
            userId,
            token: refreshToken,
            revoked: false,
          },
          data: {
            revoked: true,
          },
        });
      }

      // Log logout
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user) {
        await this.prisma.auditLog.create({
          data: {
            userId: user.id,
            tenantId: user.tenantId,
            action: 'USER_LOGOUT',
            entityType: 'USER',
            entityId: user.id,
            metadata: JSON.stringify({
              email: user.email,
              timestamp: new Date().toISOString(),
            }),
            ipAddress: requestMeta?.ipAddress || null,
            userAgent: requestMeta?.userAgent || null,
          },
        });

        logger.info(`User ${user.email} logged out`);
      }

      return { message: 'Logout successful' };
    } catch (error: any) {
      logger.error('Logout error:', error);
      throw new Error('Failed to logout');
    }
  }
}
