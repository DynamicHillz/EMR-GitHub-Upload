/**
 * Change Password Use Case Tests
 */

import { ChangePasswordUseCase } from './change-password.use-case';
import { HashService } from '../../../infrastructure/services/hash.service';
import { EmailService } from '../../../infrastructure/services/email.service';

jest.mock('../../../infrastructure/services/hash.service');
jest.mock('../../../infrastructure/services/email.service');

describe('ChangePasswordUseCase', () => {
  let useCase: ChangePasswordUseCase;
  let mockPrisma: any;

  const userId = 'user-uuid-1';
  const currentPassword = 'OldPass1!';
  const newPassword = 'NewPass1!';

  const mockUser = {
    id: userId,
    tenantId: 'tenant-1',
    email: 'nurse@clinic.test',
    firstName: 'Jane',
    password: 'hashed-old-password',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    (HashService.hash as jest.Mock).mockResolvedValue('hashed-new-password');
    (EmailService.sendPasswordChangedEmail as jest.Mock).mockResolvedValue(undefined);

    useCase = new ChangePasswordUseCase(mockPrisma);
  });

  it('should change the password, revoke sessions, and notify the user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    (HashService.compare as jest.Mock)
      .mockResolvedValueOnce(true) // current password matches
      .mockResolvedValueOnce(false); // new password differs from current

    const result = await useCase.execute(userId, currentPassword, newPassword);

    expect(HashService.compare).toHaveBeenNthCalledWith(1, currentPassword, mockUser.password);
    expect(HashService.compare).toHaveBeenNthCalledWith(2, newPassword, mockUser.password);
    expect(HashService.hash).toHaveBeenCalledWith(newPassword);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: expect.objectContaining({
        password: 'hashed-new-password',
        failedLoginAttempts: 0,
        lockedUntil: null,
        requirePasswordChange: false,
      }),
    });
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    expect(EmailService.sendPasswordChangedEmail).toHaveBeenCalledWith(mockUser.email, mockUser.firstName);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: mockUser.id,
          tenantId: mockUser.tenantId,
          action: 'PASSWORD_CHANGED',
        }),
      })
    );
    expect(result).toEqual({ message: 'Password changed successfully' });
  });

  it('should reject when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(userId, currentPassword, newPassword)).rejects.toThrow(
      /User/
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should reject when the current password is incorrect', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    (HashService.compare as jest.Mock).mockResolvedValueOnce(false);

    await expect(useCase.execute(userId, 'WrongPass1!', newPassword)).rejects.toThrow(
      'Current password is incorrect'
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should reject a new password that fails the strength check', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    (HashService.compare as jest.Mock).mockResolvedValueOnce(true); // current password ok

    await expect(useCase.execute(userId, currentPassword, 'weak')).rejects.toThrow(/Password must/);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should reject a new password that is the same as the current password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    (HashService.compare as jest.Mock)
      .mockResolvedValueOnce(true) // current password ok
      .mockResolvedValueOnce(true); // new password matches current

    await expect(useCase.execute(userId, currentPassword, newPassword)).rejects.toThrow(
      'New password must be different from current password'
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should propagate unexpected errors', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute(userId, currentPassword, newPassword)).rejects.toThrow(
      'connection lost'
    );
  });
});
