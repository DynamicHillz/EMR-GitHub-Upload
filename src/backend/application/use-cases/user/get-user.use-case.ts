/**
 * Get User Use Case
 * Retrieves user by ID
 */

import { PrismaClient } from '@prisma/client';
import { UserResponseDto } from '../../dtos/user/CreateUser.dto';
import { logger } from '../../../config/logger';
import { NotFoundError } from '../../../shared/errors/AppError';

export class GetUserUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(userId: string, viewerRole?: string): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      // Treated as "not found" rather than 403 — a plain ADMIN shouldn't be
      // able to confirm a SUPER_ADMIN account even exists, matching the
      // same rule applied to the user list (list-users.use-case.ts).
      if (!user || (user.role === 'SUPER_ADMIN' && viewerRole !== 'SUPER_ADMIN')) {
        throw new NotFoundError('User', userId);
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || undefined,
        role: user.role,
        status: user.status,
        tenantId: user.tenantId,
        lastLogin: user.lastLogin || undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error: any) {
      logger.error('Get user error:', error);
      throw error;
    }
  }
}
