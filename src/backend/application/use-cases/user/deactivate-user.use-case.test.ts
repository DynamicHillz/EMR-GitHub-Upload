/**
 * Deactivate User Use Case Tests
 */

import { DeactivateUserUseCase } from './deactivate-user.use-case';

describe('DeactivateUserUseCase', () => {
  let useCase: DeactivateUserUseCase;
  let mockPrisma: any;

  const userId = 'user-uuid-1';
  const deactivatedBy = 'admin-uuid-1';

  const mockUser = {
    id: userId,
    tenantId: 'tenant-1',
    email: 'nurse@clinic.test',
    status: 'ACTIVE',
  };

  beforeEach(() => {
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

    useCase = new DeactivateUserUseCase(mockPrisma);
  });

  it('should deactivate an active user, revoke sessions, and log it', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await useCase.execute(userId, deactivatedBy);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { status: 'INACTIVE' },
    });
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: deactivatedBy,
          tenantId: mockUser.tenantId,
          action: 'USER_DEACTIVATED',
          entityId: mockUser.id,
        }),
      })
    );
    expect(result).toEqual({ message: 'User deactivated successfully' });
  });

  it('should reject when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(userId, deactivatedBy)).rejects.toThrow('User not found');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should reject when the user is already deactivated', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, status: 'INACTIVE' });

    await expect(useCase.execute(userId, deactivatedBy)).rejects.toThrow(
      'User is already deactivated'
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('should propagate unexpected errors', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute(userId, deactivatedBy)).rejects.toThrow('connection lost');
  });
});
