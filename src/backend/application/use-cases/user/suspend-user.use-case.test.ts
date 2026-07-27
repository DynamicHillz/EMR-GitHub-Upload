/**
 * Suspend User Use Case Tests
 */

import { SuspendUserUseCase } from './suspend-user.use-case';

describe('SuspendUserUseCase', () => {
  let useCase: SuspendUserUseCase;
  let mockPrisma: any;

  const userId = 'user-uuid-1';
  const suspendedBy = 'admin-uuid-1';

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

    useCase = new SuspendUserUseCase(mockPrisma);
  });

  it('should suspend an active user indefinitely, revoke sessions, and log it', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await useCase.execute(userId, suspendedBy);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { status: 'SUSPENDED', lockedUntil: undefined },
    });
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: suspendedBy,
          tenantId: mockUser.tenantId,
          action: 'USER_SUSPENDED',
          entityId: mockUser.id,
        }),
      })
    );
    expect(result).toEqual({ message: 'User suspended successfully' });
  });

  it('should suspend a user until a given date and include it in the message', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    const until = new Date('2026-12-31T00:00:00.000Z');

    const result = await useCase.execute(userId, suspendedBy, until);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { status: 'SUSPENDED', lockedUntil: until },
    });
    expect(result).toEqual({
      message: `User suspended successfully until ${until.toLocaleDateString()}`,
    });
  });

  it('should reject when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(userId, suspendedBy)).rejects.toThrow('User not found');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should reject when the user is already suspended', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });

    await expect(useCase.execute(userId, suspendedBy)).rejects.toThrow('User is already suspended');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('should propagate unexpected errors', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute(userId, suspendedBy)).rejects.toThrow('connection lost');
  });
});
