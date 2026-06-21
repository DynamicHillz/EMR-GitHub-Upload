/**
 * Change Password Use Case
 * Handles user password change
 */

import { PrismaClient } from '@prisma/client';
import { HashService } from '../../../infrastructure/services/hash.service';
import { UserService } from '../../../domain/services/user.service';
import { EmailService } from '../../../infrastructure/services/email.service';
import { logger } from '../../../config/logger';
import { NotFoundError, ValidationError, UnauthorizedError } from '../../../shared/errors/AppError';

export class ChangePasswordUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    try {
      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Verify current password
      const isValidPassword = await HashService.compare(currentPassword, user.password);
      if (!isValidPassword) {
        throw new UnauthorizedError('Current password is incorrect');
      }

      // Validate new password strength
      const passwordValidation = UserService.validatePassword(newPassword);
      if (!passwordValidation.valid) {
        throw new ValidationError(passwordValidation.errors.join('. '));
      }

      // Check if new password is same as current
      const isSamePassword = await HashService.compare(newPassword, user.password);
      if (isSamePassword) {
        throw new ValidationError('New password must be different from current password');
      }

      // Hash new password
      const hashedPassword = await HashService.hash(newPassword);

      // Update password
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Revoke all refresh tokens (force re-login on all devices)
      await this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      });

      // Send password changed email
      await EmailService.sendPasswordChangedEmail(user.email, user.firstName);

      // Log password change
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          action: 'PASSWORD_CHANGED',
          entityType: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            email: user.email,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      logger.info(`Password changed for user: ${user.email}`);

      return { message: 'Password changed successfully' };
    } catch (error: any) {
      logger.error('Change password error:', error);
      throw error;
    }
  }
}
