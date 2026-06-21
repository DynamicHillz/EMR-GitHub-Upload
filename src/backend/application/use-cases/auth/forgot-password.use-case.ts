/**
 * Forgot Password Use Case
 * Handles password reset request
 */

import { PrismaClient } from '@prisma/client';
import { TokenService } from '../../../infrastructure/services/token.service';
import { EmailService } from '../../../infrastructure/services/email.service';
import { ForgotPasswordDto } from '../../dtos/user/ResetPassword.dto';
import { logger } from '../../../config/logger';

export class ForgotPasswordUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: ForgotPasswordDto): Promise<{ message: string }> {
    try {
      // Find user by email and tenant
      const user = await this.prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: dto.tenantId,
            email: dto.email,
          },
        },
      });

      // Always return success message to prevent email enumeration
      const successMessage =
        'If an account exists with this email, you will receive password reset instructions.';

      if (!user) {
        logger.warn(`Password reset requested for non-existent email: ${dto.email}`);
        return { message: successMessage };
      }

      // Check if account is active
      if (user.status !== 'ACTIVE') {
        logger.warn(`Password reset requested for ${user.status} account: ${dto.email}`);
        return { message: successMessage };
      }

      // Mark all existing reset tokens as used
      await this.prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          used: false,
        },
        data: {
          used: true,
        },
      });

      // Generate reset token
      const resetToken = TokenService.generateResetToken();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiry

      // Store reset token
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: resetToken,
          expiresAt,
          used: false,
        },
      });

      // Send password reset email
      await EmailService.sendPasswordResetEmail(user.email, user.firstName, resetToken);

      // Log password reset request
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          action: 'PASSWORD_RESET_REQUESTED',
          entityType: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            email: user.email,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      logger.info(`Password reset email sent to ${user.email}`);

      return { message: successMessage };
    } catch (error: any) {
      logger.error('Forgot password error:', error);
      throw new Error('Failed to process password reset request');
    }
  }
}
