/**
 * Reset Password Use Case
 * Handles password reset with token
 */

import { PrismaClient } from '@prisma/client';
import { HashService } from '../../../infrastructure/services/hash.service';
import { UserService } from '../../../domain/services/user.service';
import { EmailService } from '../../../infrastructure/services/email.service';
import { ResetPasswordDto } from '../../dtos/user/ResetPassword.dto';
import { logger } from '../../../config/logger';

export class ResetPasswordUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: ResetPasswordDto): Promise<{ message: string }> {
    try {
      // Find reset token
      const resetToken = await this.prisma.passwordResetToken.findUnique({
        where: { token: dto.token },
        include: { user: true },
      });

      if (!resetToken) {
        throw new Error('Invalid or expired reset token');
      }

      // Check if token is already used
      if (resetToken.used) {
        throw new Error('Reset token has already been used');
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        throw new Error('Reset token has expired. Please request a new password reset.');
      }

      // Validate new password
      const passwordValidation = UserService.validatePassword(dto.newPassword);
      if (!passwordValidation.valid) {
        throw new Error(passwordValidation.errors.join('. '));
      }

      // Hash new password
      const hashedPassword = await HashService.hash(dto.newPassword);

      // Update user password
      await this.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          password: hashedPassword,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Mark token as used
      await this.prisma.passwordResetToken.update({
        where: { token: dto.token },
        data: { used: true },
      });

      // Revoke all refresh tokens for security
      await this.prisma.refreshToken.updateMany({
        where: {
          userId: resetToken.userId,
          revoked: false,
        },
        data: { revoked: true },
      });

      // Send confirmation email
      await EmailService.sendPasswordChangedEmail(
        resetToken.user.email,
        resetToken.user.firstName
      );

      // Log password reset
      await this.prisma.auditLog.create({
        data: {
          userId: resetToken.userId,
          tenantId: resetToken.user.tenantId,
          action: 'PASSWORD_RESET_COMPLETED',
          entityType: 'USER',
          entityId: resetToken.userId,
          metadata: JSON.stringify({
            email: resetToken.user.email,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      logger.info(`Password reset successful for user ${resetToken.user.email}`);

      return { message: 'Password reset successful. You can now login with your new password.' };
    } catch (error: any) {
      logger.error('Reset password error:', error);
      throw error;
    }
  }
}
