/**
 * Reactivate User Use Case Tests
 */

import { ReactivateUserUseCase } from './reactivate-user.use-case';

describe('ReactivateUserUseCase', () => {
  let useCase: ReactivateUserUseCase;
  let mockPrisma: any;

  const userId = 'user-uuid-1';
  const reactivatedBy = 'admin-uuid-1';

  const mockUser = {
    id: userId,
    tenantId: 'tenant-1',
    email: 'nurse@clinic.test',
    status: 'SUSPENDED',
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    useCase = new ReactivateUserUseCase(mockPrisma);
  });

  it('should reactivate a suspended user, clear lockout state, and log it', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await useCase.execute(userId, reactivatedBy);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { status: 'ACTIVE', failedLoginAttempts: 0, lockedUntil: null },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: reactivatedBy,
          tenantId: mockUser.tenantId,
          action: 'USER_REACTIVATED',
          entityId: mockUser.id,
        }),
      })
    );
    expect(result).toEqual({ message: 'User reactivated successfully' });
  });

  it('should reactivate a deactivated (INACTIVE) user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, status: 'INACTIVE' });

    const result = await useCase.execute(userId, reactivatedBy);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { status: 'ACTIVE', failedLoginAttempts: 0, lockedUntil: null },
    });
    expect(result).toEqual({ message: 'User reactivated successfully' });
  });

  it('should reject when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(userId, reactivatedBy)).rejects.toThrow('User not found');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should reject when the user is already active', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, status: 'ACTIVE' });

    await expect(useCase.execute(userId, reactivatedBy)).rejects.toThrow('User is already active');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should propagate unexpected errors', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute(userId, reactivatedBy)).rejects.toThrow('connection lost');
  });
});
