/**
 * Create User Use Case
 * Handles user creation by admin
 */

import { PrismaClient } from '@prisma/client';
import { HashService } from '../../../infrastructure/services/hash.service';
import { UserService } from '../../../domain/services/user.service';
import { EmailService } from '../../../infrastructure/services/email.service';
import { CreateUserDto, UserResponseDto } from '../../dtos/user/CreateUser.dto';
import { logger } from '../../../config/logger';
import { ValidationError, ConflictError } from '../../../shared/errors/AppError';

export class CreateUserUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: CreateUserDto, createdBy: string): Promise<UserResponseDto> {
    try {
      // Validate email format
      if (!UserService.validateEmail(dto.email)) {
        throw new ValidationError('Invalid email format');
      }

      // Validate password strength
      const passwordValidation = UserService.validatePassword(dto.password);
      if (!passwordValidation.valid) {
        throw new ValidationError(passwordValidation.errors.join('. '));
      }

      // Validate role
      if (!UserService.validateRole(dto.role)) {
        throw new ValidationError('Invalid role');
      }

      // Check if email already exists for this tenant
      const existingUser = await this.prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: dto.tenantId,
            email: dto.email,
          },
        },
      });

      if (existingUser) {
        throw new ConflictError('Email already registered');
      }

      // Hash password
      const hashedPassword = await HashService.hash(dto.password);

      // Create user
      const user = await this.prisma.user.create({
        data: {
          tenantId: dto.tenantId,
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: dto.role as any,
          status: 'ACTIVE' as any,
          failedLoginAttempts: 0,
          // @ts-ignore - Temporary fix for schema alignment
          requirePasswordChange: true,
        },
      });

      // Send welcome email with temporary password if requested
      if (dto.sendWelcomeEmail) {
        await EmailService.sendWelcomeEmail(user.email, user.firstName, dto.password);
      }

      // Log user creation
      await this.prisma.auditLog.create({
        data: {
          userId: createdBy,
          tenantId: user.tenantId,
          action: 'USER_CREATED',
          entityType: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            email: user.email,
            role: user.role,
            createdBy,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      logger.info(`User created: ${user.email} by ${createdBy}`);

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
      logger.error('Create user error:', error);
      throw error;
    }
  }
}
