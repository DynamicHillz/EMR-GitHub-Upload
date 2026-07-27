/**
 * Logout Use Case Tests
 */

import { LogoutUseCase } from './logout.use-case';

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;
  let mockPrisma: any;

  const userId = 'user-uuid-1';
  const refreshToken = 'refresh-token-abc';

  const mockUser = {
    id: userId,
    tenantId: 'tenant-1',
    email: 'doctor@clinic.test',
  };

  beforeEach(() => {
    mockPrisma = {
      refreshToken: {
        updateMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    useCase = new LogoutUseCase(mockPrisma);
  });

  it('should revoke the refresh token and log the logout when a token is provided', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await useCase.execute(userId, refreshToken);

    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId, token: refreshToken, revoked: false },
      data: { revoked: true },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: mockUser.id,
          tenantId: mockUser.tenantId,
          action: 'USER_LOGOUT',
        }),
      })
    );
    expect(result).toEqual({ message: 'Logout successful' });
  });

  it('should not attempt to revoke a token when none is provided', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    await useCase.execute(userId);

    expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('should skip audit logging when the user no longer exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await useCase.execute(userId, refreshToken);

    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    expect(result).toEqual({ message: 'Logout successful' });
  });

  it('should wrap unexpected errors in a generic failure message', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute(userId, refreshToken)).rejects.toThrow('Failed to logout');
  });
});
