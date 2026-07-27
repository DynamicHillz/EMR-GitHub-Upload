/**
 * List Users Use Case Tests
 */

import { ListUsersUseCase } from './list-users.use-case';

describe('ListUsersUseCase', () => {
  let useCase: ListUsersUseCase;
  let mockPrisma: any;

  const mockUsers = [
    {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@clinic.test',
      firstName: 'A',
      lastName: 'One',
      phone: null,
      role: 'NURSE',
      status: 'ACTIVE',
      lastLogin: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: jest.fn().mockResolvedValue(mockUsers),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    useCase = new ListUsersUseCase(mockPrisma);
  });

  it('should scope by tenant, exclude SUPER_ADMIN by default, and apply default pagination', async () => {
    const result = await useCase.execute({ tenantId: 'tenant-1' });

    const expectedWhere = { tenantId: 'tenant-1', NOT: { role: 'SUPER_ADMIN' } };
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      take: 50,
      skip: 0,
      orderBy: { createdAt: 'desc' },
    });
    expect(mockPrisma.user.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(result).toEqual({
      users: [
        {
          id: 'user-1',
          email: 'a@clinic.test',
          firstName: 'A',
          lastName: 'One',
          phone: undefined,
          role: 'NURSE',
          status: 'ACTIVE',
          tenantId: 'tenant-1',
          lastLogin: undefined,
          createdAt: mockUsers[0].createdAt,
          updatedAt: mockUsers[0].updatedAt,
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });
  });

  it('should not exclude SUPER_ADMIN accounts when the viewer is a SUPER_ADMIN', async () => {
    await useCase.execute({ tenantId: 'tenant-1', viewerRole: 'SUPER_ADMIN' });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } })
    );
  });

  it('should apply role, status, and search filters', async () => {
    await useCase.execute({
      tenantId: 'tenant-1',
      role: 'DOCTOR',
      status: 'ACTIVE',
      search: 'jane',
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          role: 'DOCTOR',
          status: 'ACTIVE',
          OR: [
            { firstName: { contains: 'jane' } },
            { lastName: { contains: 'jane' } },
            { email: { contains: 'jane' } },
          ],
          NOT: { role: 'SUPER_ADMIN' },
        },
      })
    );
  });

  it('should apply custom limit and offset', async () => {
    const result = await useCase.execute({ tenantId: 'tenant-1', limit: 10, offset: 20 });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 })
    );
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(20);
  });

  it('should propagate unexpected errors', async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute({ tenantId: 'tenant-1' })).rejects.toThrow('connection lost');
  });
});
