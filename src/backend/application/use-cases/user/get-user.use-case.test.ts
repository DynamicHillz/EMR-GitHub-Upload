/**
 * Get User Use Case Tests
 */

import { GetUserUseCase } from './get-user.use-case';

describe('GetUserUseCase', () => {
  let useCase: GetUserUseCase;
  let mockPrisma: any;

  const userId = 'user-uuid-1';

  const mockUser = {
    id: userId,
    tenantId: 'tenant-1',
    email: 'nurse@clinic.test',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: null,
    role: 'NURSE',
    status: 'ACTIVE',
    lastLogin: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    useCase = new GetUserUseCase(mockPrisma);
  });

  it('should return the shaped user dto for an existing user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await useCase.execute(userId, 'ADMIN');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: userId } });
    expect(result).toEqual({
      id: mockUser.id,
      email: mockUser.email,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      phone: undefined,
      role: mockUser.role,
      status: mockUser.status,
      tenantId: mockUser.tenantId,
      lastLogin: undefined,
      createdAt: mockUser.createdAt,
      updatedAt: mockUser.updatedAt,
    });
  });

  it('should reject when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(userId, 'ADMIN')).rejects.toThrow(/User/);
  });

  it('should mask a SUPER_ADMIN account as not found from a non-SUPER_ADMIN viewer', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, role: 'SUPER_ADMIN' });

    await expect(useCase.execute(userId, 'ADMIN')).rejects.toThrow(/User/);
  });

  it('should return a SUPER_ADMIN account when viewed by another SUPER_ADMIN', async () => {
    const superAdmin = { ...mockUser, role: 'SUPER_ADMIN' };
    mockPrisma.user.findUnique.mockResolvedValue(superAdmin);

    const result = await useCase.execute(userId, 'SUPER_ADMIN');

    expect(result.role).toBe('SUPER_ADMIN');
  });

  it('should mask a SUPER_ADMIN account when no viewer role is supplied', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, role: 'SUPER_ADMIN' });

    await expect(useCase.execute(userId)).rejects.toThrow(/User/);
  });

  it('should propagate unexpected errors', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute(userId, 'ADMIN')).rejects.toThrow('connection lost');
  });
});
