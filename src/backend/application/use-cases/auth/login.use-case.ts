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

  // Every rejection branch below writes its own AuditLog row — previously
  // only a *successful* login ever reached the compliance-facing audit
  // trail; failed attempts, lockouts, and suspended-account/tenant hits only
  // went to the Winston logger, invisible to the Audit Log page. Wrapped in
  // its own try/catch (swallow + log) so a DB hiccup writing the audit row
  // can never replace the real auth error the caller is supposed to see.
  private async logAuditSafe(entry: {
    userId: string | null;
    tenantId: string;
    action: string;
    entityId: string | null;
    metadata: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          tenantId: entry.tenantId,
          action: entry.action,
          entityType: 'USER',
          entityId: entry.entityId,
          metadata: JSON.stringify(entry.metadata),
          ipAddress: entry.ipAddress || null,
          userAgent: entry.userAgent || null,
        },
      });
    } catch (err) {
      logger.error('Failed to write login audit log:', err);
    }
  }

  async execute(dto: LoginUserDto, tenantId: string, requestMeta?: { ipAddress?: string; userAgent?: string }): Promise<LoginUserResponseDto> {
    try {
      // Reject login for a suspended/inactive clinic before even looking up
      // the user — Tenant.status existed in the schema but was never
      // enforced anywhere, making the SUPER_ADMIN "suspend a clinic" action
      // a no-op. Message deliberately contains "suspended"/"inactive" so
      // auth.controller.ts's existing substring check maps it to a 403.
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { status: true },
      });

      if (tenant && tenant.status !== 'ACTIVE') {
        logger.warn(`Login attempt for ${tenant.status} tenant ${tenantId}`);
        await this.logAuditSafe({
          userId: null,
          tenantId,
          action: 'LOGIN_FAILED',
          entityId: null,
          metadata: { attemptedEmail: dto.email, reason: 'tenant_suspended', tenantStatus: tenant.status },
          ipAddress: requestMeta?.ipAddress,
          userAgent: requestMeta?.userAgent,
        });
        throw new Error(`This clinic account is ${tenant.status.toLowerCase()}. Please contact support.`);
      }

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
        await this.logAuditSafe({
          userId: null,
          tenantId,
          action: 'LOGIN_FAILED',
          entityId: null,
          metadata: { attemptedEmail: dto.email, reason: 'no_such_user' },
          ipAddress: requestMeta?.ipAddress,
          userAgent: requestMeta?.userAgent,
        });
        throw new Error('Invalid email or password');
      }

      // Check if account is locked
      if (user.lockedUntil && new Date() < user.lockedUntil) {
        const unlockTime = user.lockedUntil.toLocaleString();
        await this.logAuditSafe({
          userId: user.id,
          tenantId: user.tenantId,
          action: 'LOGIN_FAILED',
          entityId: user.id,
          metadata: { email: user.email, reason: 'account_locked', lockedUntil: user.lockedUntil },
          ipAddress: requestMeta?.ipAddress,
          userAgent: requestMeta?.userAgent,
        });
        throw new Error(`Account is locked until ${unlockTime}. Please try again later.`);
      }

      // Check if account is active
      if (user.status !== 'ACTIVE') {
        await this.logAuditSafe({
          userId: user.id,
          tenantId: user.tenantId,
          action: 'LOGIN_FAILED',
          entityId: user.id,
          metadata: { email: user.email, reason: 'account_inactive', status: user.status },
          ipAddress: requestMeta?.ipAddress,
          userAgent: requestMeta?.userAgent,
        });
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
          await this.logAuditSafe({
            userId: user.id,
            tenantId: user.tenantId,
            action: 'ACCOUNT_LOCKED',
            entityId: user.id,
            metadata: { email: user.email, reason: 'too_many_failed_attempts', failedAttempts: newFailedAttempts, lockedUntil },
            ipAddress: requestMeta?.ipAddress,
            userAgent: requestMeta?.userAgent,
          });
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

          const remainingAttempts = 5 - newFailedAttempts;
          logger.warn(
            `Failed login attempt for ${user.email}. Attempts: ${newFailedAttempts}. Remaining: ${remainingAttempts}`
          );
          await this.logAuditSafe({
            userId: user.id,
            tenantId: user.tenantId,
            action: 'LOGIN_FAILED',
            entityId: user.id,
            metadata: { email: user.email, reason: 'invalid_password', failedAttempts: newFailedAttempts, remainingAttempts },
            ipAddress: requestMeta?.ipAddress,
            userAgent: requestMeta?.userAgent,
          });
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

      // Check if password has expired
      const passwordExpired = UserService.isPasswordExpired(
        (user as any).passwordChangedAt || null
      );

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
            ipAddress: requestMeta?.ipAddress,
            userAgent: requestMeta?.userAgent,
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
          ipAddress: requestMeta?.ipAddress || null,
          userAgent: requestMeta?.userAgent || null,
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
          // @ts-ignore - Temporary fix for schema alignment
          requirePasswordChange: user.requirePasswordChange || passwordExpired,
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
