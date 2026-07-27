/**
 * Forgot Password Use Case Tests
 *
 * The response message must stay identical whether or not the account
 * exists (US requirement to prevent email enumeration) - that invariant is
 * the main thing worth locking down here.
 */

import { ForgotPasswordUseCase } from './forgot-password.use-case';
import { TokenService } from '../../../infrastructure/services/token.service';
import { EmailService } from '../../../infrastructure/services/email.service';

jest.mock('../../../infrastructure/services/token.service');
jest.mock('../../../infrastructure/services/email.service');

describe('ForgotPasswordUseCase', () => {
  let useCase: ForgotPasswordUseCase;
  let mockPrisma: any;

  const dto = { email: 'doctor@clinic.test', tenantId: 'tenant-1' };

  const mockUser = {
    id: 'user-uuid-1',
    tenantId: dto.tenantId,
    email: dto.email,
    firstName: 'Jane',
    status: 'ACTIVE',
  };

  const enumerationSafeMessage =
    'If an account exists with this email, you will receive password reset instructions.';

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      user: { findUnique: jest.fn() },
      passwordResetToken: { updateMany: jest.fn(), create: jest.fn() },
      auditLog: { create: jest.fn() },
    };

    (TokenService.generateResetToken as jest.Mock).mockReturnValue('reset-token-abc');
    (EmailService.sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

    useCase = new ForgotPasswordUseCase(mockPrisma);
  });

  it('should generate and store a reset token, and email it, for an active account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await useCase.execute(dto);

    expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: mockUser.id, used: false },
      data: { used: true },
    });
    expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: mockUser.id, token: 'reset-token-abc', used: false }),
      })
    );
    expect(EmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      mockUser.email,
      mockUser.firstName,
      'reset-token-abc'
    );
    expect(result.message).toBe(enumerationSafeMessage);
  });

  it('should return the same success message without issuing a token when the email does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await useCase.execute(dto);

    expect(result.message).toBe(enumerationSafeMessage);
    expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(EmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('should return the same success message without issuing a token for a non-active account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });

    const result = await useCase.execute(dto);

    expect(result.message).toBe(enumerationSafeMessage);
    expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(EmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('should wrap unexpected errors in a generic failure message', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute(dto)).rejects.toThrow('Failed to process password reset request');
  });
});
