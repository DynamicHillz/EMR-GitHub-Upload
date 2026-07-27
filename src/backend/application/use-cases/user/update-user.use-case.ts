/**
 * Update User Use Case
 * Handles user information updates
 */

import { PrismaClient } from '@prisma/client';
import { UserService } from '../../../domain/services/user.service';
import { UpdateUserDto } from '../../dtos/user/UpdateUser.dto';
import { UserResponseDto } from '../../dtos/user/CreateUser.dto';
import { logger } from '../../../config/logger';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export class UpdateUserUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(userId: string, dto: UpdateUserDto, updatedBy: string, updaterRole?: string): Promise<UserResponseDto> {
    try {
      // Find user
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        throw new NotFoundError('User', userId);
      }

      // Defense-in-depth: role/status are administrative fields. The
      // controller already strips these for non-admin callers editing their
      // own record, but this use-case has no other caller-context of its
      // own, so re-check here rather than trusting the DTO unconditionally —
      // any future caller that skips the controller's check would otherwise
      // let a user grant themselves elevated privileges.
      if (updaterRole !== undefined && updaterRole !== 'ADMIN' && updaterRole !== 'SUPER_ADMIN') {
        delete dto.role;
        delete dto.status;
      }

      // Validate role if being updated
      if (dto.role && !UserService.validateRole(dto.role)) {
        throw new ValidationError('Invalid role');
      }

      // Validate status if being updated
      if (dto.status && !UserService.validateStatus(dto.status)) {
        throw new ValidationError('Invalid status');
      }

      // Track changes for audit log
      const changes: any = {};
      if (dto.firstName && dto.firstName !== existingUser.firstName) {
        changes.firstName = { from: existingUser.firstName, to: dto.firstName };
      }
      if (dto.lastName && dto.lastName !== existingUser.lastName) {
        changes.lastName = { from: existingUser.lastName, to: dto.lastName };
      }
      if (dto.phone && dto.phone !== existingUser.phone) {
        changes.phone = { from: existingUser.phone, to: dto.phone };
      }
      if (dto.role && dto.role !== existingUser.role) {
        changes.role = { from: existingUser.role, to: dto.role };
      }
      if (dto.status && dto.status !== existingUser.status) {
        changes.status = { from: existingUser.status, to: dto.status };
      }

      // Update user
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: dto.role as any,
          status: dto.status as any,
        },
      });

      // Log user update
      await this.prisma.auditLog.create({
        data: {
          userId: updatedBy,
          tenantId: user.tenantId,
          action: 'USER_UPDATED',
          entityType: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            ...changes,
            updatedBy,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      logger.info(`User updated: ${user.email} by ${updatedBy}`);

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
      logger.error('Update user error:', error);
      throw error;
    }
  }
}
