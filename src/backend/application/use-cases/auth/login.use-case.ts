/**
 * Login Use Case
 * Handles user authentication and login
 */

import { PrismaClient } from '@prisma/client';
import { HashService } from '../../../infrastructure/services/hash.service';
import { TokenService } from '../../../infrastructure/services/token.service';
import { UserService } from '../../../domain/services/user.service';
import { EmailService } from '../../../infrastructure/services/email.service';
import { LoginUserDto, LoginUserResponseDto } from '../../dtos/user/LoginUser.dto';
import { logger } from '../../../config/logger';

export class LoginUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: LoginUserDto, tenantId: string): Promise<LoginUserResponseDto> {
    try {
      // Find user by email and tenant
      const user = await this.prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId,
            email: dto.email,
          },
        },
      });

      if (!user) {
        logger.warn(`Login attempt with non-existent email: ${dto.email}`);
        throw new Error('Invalid email or password');
      }

      // Check if account is locked
      if (user.lockedUntil && new Date() < user.lockedUntil) {
        const unlockTime = user.lockedUntil.toLocaleString();
        throw new Error(`Account is locked until ${unlockTime}. Please try again later.`);
      }

      // Check if account is active
      if (user.status !== 'ACTIVE') {
        throw new Error(`Account is ${user.status.toLowerCase()}. Please contact administrator.`);
      }

      // Verify password
      const isPasswordValid = await HashService.compare(dto.password, user.password);

      if (!isPasswordValid) {
        // Increment failed login attempts
        const newFailedAttempts = user.failedLoginAttempts + 1;
        const shouldLock = UserService.shouldLockAccount(newFailedAttempts);

        if (shouldLock) {
          const lockoutMinutes = UserService.getLockoutDuration();
          const lockedUntil = new Date();
          lockedUntil.setMinutes(lockedUntil.getMinutes() + lockoutMinutes);

          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: newFailedAttempts,
              lockedUntil,
            },
          });

          // Send account locked email
          await EmailService.sendAccountLockedEmail(user.email, user.firstName, lockedUntil);

          logger.warn(`Account locked for user ${user.email} due to ${newFailedAttempts} failed attempts`);
          throw new Error(
            `Account locked due to too many failed login attempts. Please try again in ${lockoutMinutes} minutes.`
          );
        } else {
          // Update failed attempts
          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: newFailedAttempts,
            },
          });

          const remainingAttempts = UserService.shouldLockAccount(0) ? 5 - newFailedAttempts : 0;
          logger.warn(
            `Failed login attempt for ${user.email}. Attempts: ${newFailedAttempts}. Remaining: ${remainingAttempts}`
          );
          throw new Error(
            `Invalid email or password. ${remainingAttempts} attempts remaining before account lockout.`
          );
        }
      }

      // Successful login - reset failed attempts and update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Generate tokens
      const accessToken = TokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      });

      let refreshToken: string | undefined;
      if (dto.rememberMe) {
        refreshToken = TokenService.generateRefreshToken();
        const expiresAt = TokenService.calculateExpiryDate(process.env.JWT_REFRESH_EXPIRY || '30d');

        await this.prisma.refreshToken.create({
          data: {
            userId: user.id,
            token: refreshToken,
            expiresAt,
          },
        });
      }

      // Log successful login
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          action: 'USER_LOGIN',
          entityType: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            email: user.email,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      logger.info(`User ${user.email} logged in successfully`);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
        },
        accessToken,
        refreshToken,
        expiresIn: TokenService.getTokenExpiry(),
      };
    } catch (error: any) {
      logger.error('Login error:', error);
      throw error;
    }
  }
}
