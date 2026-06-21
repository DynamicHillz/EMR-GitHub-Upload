/**
 * Register Use Case
 * Handles user registration
 */

import { PrismaClient } from '@prisma/client';
import { UserRole } from '../../../shared/types/prisma-enums';
import { HashService } from '../../../infrastructure/services/hash.service';
import { UserService } from '../../../domain/services/user.service';
import { EmailService } from '../../../infrastructure/services/email.service';
import { TokenService } from '../../../infrastructure/services/token.service';
import { RegisterUserDto, RegisterUserResponseDto } from '../../dtos/user/RegisterUser.dto';
import { logger } from '../../../config/logger';
import { ValidationError, ConflictError } from '../../../shared/errors/AppError';

export class RegisterUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: RegisterUserDto): Promise<RegisterUserResponseDto> {
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
        logger.warn(`Registration attempt with existing email: ${dto.email}`);
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
          role: dto.role as UserRole,
          status: 'ACTIVE',
          failedLoginAttempts: 0,
        },
      });

      // Send welcome email
      await EmailService.sendWelcomeEmail(user.email, user.firstName);

      // Log registration
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          action: 'USER_REGISTRATION',
          entityType: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            email: user.email,
            role: user.role,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      logger.info(`New user registered: ${user.email} (${user.role})`);

      // Generate JWT access token
      const accessToken = TokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      });

      // Generate refresh token
      const refreshToken = TokenService.generateRefreshToken();
      const refreshTokenExpiry = TokenService.calculateExpiryDate('30d'); // 30 days

      // Store refresh token
      await this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: refreshTokenExpiry,
        },
      });

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        createdAt: user.createdAt,
        token: accessToken,
        refreshToken,
      };
    } catch (error: any) {
      logger.error('Registration error:', error);
      throw error;
    }
  }
}
