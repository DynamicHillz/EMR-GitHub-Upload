/**
 * Forgot/Reset Password Integration Tests
 *
 * Covers ForgotPasswordUseCase (email-enumeration resistance) and
 * ResetPasswordUseCase (token validity/expiry, password strength gate,
 * one-time-use enforcement, and the security side-effect of revoking all
 * refresh tokens on a successful reset).
 */

import { PrismaClient } from '@prisma/client';
import { ForgotPasswordUseCase } from '../../application/use-cases/auth/forgot-password.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/auth/reset-password.use-case';
import { createTestPrisma, createTestTenant, createTestUser, cleanDatabase } from '../helpers/test-helpers';

const VALID_NEW_PASSWORD = 'NewSecure#Pass99';

describe('Forgot/Reset Password Integration', () => {
  let prisma: PrismaClient;
  let forgotUseCase: ForgotPasswordUseCase;
  let resetUseCase: ResetPasswordUseCase;
  let tenantId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    forgotUseCase = new ForgotPasswordUseCase(prisma);
    resetUseCase = new ResetPasswordUseCase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma, tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  describe('ForgotPasswordUseCase', () => {
    it('should create a reset token for a real user and return the generic success message', async () => {
      const user = await createTestUser(prisma, tenantId, { email: 'forgot-real@test.com' });

      const result = await forgotUseCase.execute({ email: user.email, tenantId });

      expect(result.message).toContain('you will receive password reset instructions');

      const token = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });
      expect(token).not.toBeNull();
      expect(token?.used).toBe(false);
    });

    it('should return the same generic message for a non-existent email (no enumeration)', async () => {
      const result = await forgotUseCase.execute({ email: 'nobody-forgot@test.com', tenantId });

      expect(result.message).toContain('you will receive password reset instructions');
    });

    it('should invalidate a previous unused token when a new reset is requested', async () => {
      const user = await createTestUser(prisma, tenantId, { email: 'forgot-twice@test.com' });

      await forgotUseCase.execute({ email: user.email, tenantId });
      const firstToken = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });

      await forgotUseCase.execute({ email: user.email, tenantId });

      const dbFirstToken = await prisma.passwordResetToken.findUnique({ where: { token: firstToken!.token } });
      expect(dbFirstToken?.used).toBe(true);

      const activeTokens = await prisma.passwordResetToken.findMany({
        where: { userId: user.id, used: false },
      });
      expect(activeTokens).toHaveLength(1);
    });
  });

  describe('ResetPasswordUseCase', () => {
    it('should reset the password with a valid token and revoke all existing refresh tokens', async () => {
      const user = await createTestUser(prisma, tenantId, { email: 'reset-ok@test.com' });
      await prisma.refreshToken.create({
        data: { userId: user.id, token: 'old-refresh-token-1', expiresAt: new Date(Date.now() + 86400000) },
      });

      await forgotUseCase.execute({ email: user.email, tenantId });
      const resetToken = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });

      const result = await resetUseCase.execute({ token: resetToken!.token, newPassword: VALID_NEW_PASSWORD });

      expect(result.message).toContain('Password reset successful');

      const dbToken = await prisma.passwordResetToken.findUnique({ where: { token: resetToken!.token } });
      expect(dbToken?.used).toBe(true);

      const dbRefreshToken = await prisma.refreshToken.findUnique({ where: { token: 'old-refresh-token-1' } });
      expect(dbRefreshToken?.revoked).toBe(true);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.password).not.toBe(user.password); // password hash actually changed
    });

    it('should reject an invalid/unknown token', async () => {
      await expect(
        resetUseCase.execute({ token: 'not-a-real-token', newPassword: VALID_NEW_PASSWORD })
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should reject a token that has already been used', async () => {
      const user = await createTestUser(prisma, tenantId, { email: 'reset-reuse@test.com' });
      await forgotUseCase.execute({ email: user.email, tenantId });
      const resetToken = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });

      await resetUseCase.execute({ token: resetToken!.token, newPassword: VALID_NEW_PASSWORD });

      await expect(
        resetUseCase.execute({ token: resetToken!.token, newPassword: 'AnotherValid#99' })
      ).rejects.toThrow('Reset token has already been used');
    });

    it('should reject an expired token', async () => {
      const user = await createTestUser(prisma, tenantId, { email: 'reset-expired@test.com' });
      const expiredToken = await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: 'expired-token-abc',
          expiresAt: new Date(Date.now() - 60000), // 1 minute ago
          used: false,
        },
      });

      await expect(
        resetUseCase.execute({ token: expiredToken.token, newPassword: VALID_NEW_PASSWORD })
      ).rejects.toThrow('Reset token has expired');
    });

    it('should reject a new password that does not meet strength requirements', async () => {
      const user = await createTestUser(prisma, tenantId, { email: 'reset-weakpw@test.com' });
      await forgotUseCase.execute({ email: user.email, tenantId });
      const resetToken = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });

      await expect(
        resetUseCase.execute({ token: resetToken!.token, newPassword: 'weak' })
      ).rejects.toThrow(/Password must/);

      // Token must remain usable since the weak-password attempt never completed
      const dbToken = await prisma.passwordResetToken.findUnique({ where: { token: resetToken!.token } });
      expect(dbToken?.used).toBe(false);
    });
  });
});
