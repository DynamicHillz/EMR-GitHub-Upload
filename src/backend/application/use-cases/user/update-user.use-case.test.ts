/**
 * Update User Use Case Tests
 */

import { UpdateUserUseCase } from './update-user.use-case';
import { UpdateUserDto } from '../../dtos/user/UpdateUser.dto';

describe('UpdateUserUseCase', () => {
  let useCase: UpdateUserUseCase;
  let mockPrisma: any;

  const userId = 'user-uuid-1';
  const updatedBy = 'admin-uuid-1';

  const existingUser = {
    id: userId,
    tenantId: 'tenant-1',
    email: 'nurse@clinic.test',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '08000000000',
    role: 'NURSE',
    status: 'ACTIVE',
    lastLogin: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const buildUpdatedUser = (overrides: Partial<typeof existingUser>) => ({
    ...existingUser,
    ...overrides,
    updatedAt: new Date('2026-02-01'),
  });

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

    useCase = new UpdateUserUseCase(mockPrisma);
  });

  it('should update allowed fields and log the change when an admin edits role/status', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(existingUser);
    const dto: UpdateUserDto = { firstName: 'Janet', role: 'DOCTOR', status: 'ACTIVE' };
    const updated = buildUpdatedUser({ firstName: 'Janet', role: 'DOCTOR' });
    mockPrisma.user.update.mockResolvedValue(updated);

    const result = await useCase.execute(userId, dto, updatedBy, 'ADMIN');

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: {
        firstName: 'Janet',
        lastName: undefined,
        phone: undefined,
        role: 'DOCTOR',
        status: 'ACTIVE',
      },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: updatedBy,
          tenantId: updated.tenantId,
          action: 'USER_UPDATED',
          entityId: updated.id,
        }),
      })
    );
    const metadata = JSON.parse(mockPrisma.auditLog.create.mock.calls[0][0].data.metadata);
    expect(metadata.firstName).toEqual({ from: 'Jane', to: 'Janet' });
    expect(metadata.role).toEqual({ from: 'NURSE', to: 'DOCTOR' });
    expect(result.firstName).toBe('Janet');
    expect(result.role).toBe('DOCTOR');
  });

  it('should strip role and status fields for a non-admin updater', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(existingUser);
    const dto: UpdateUserDto = { firstName: 'Janet', role: 'ADMIN', status: 'INACTIVE' };
    mockPrisma.user.update.mockResolvedValue(buildUpdatedUser({ firstName: 'Janet' }));

    await useCase.execute(userId, dto, updatedBy, 'NURSE');

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: {
        firstName: 'Janet',
        lastName: undefined,
        phone: undefined,
        role: undefined,
        status: undefined,
      },
    });
  });

  it('should not strip role/status when no updater role is provided (no caller context)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(existingUser);
    const dto: UpdateUserDto = { role: 'DOCTOR' };
    mockPrisma.user.update.mockResolvedValue(buildUpdatedUser({ role: 'DOCTOR' }));

    await useCase.execute(userId, dto, updatedBy, undefined);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: expect.objectContaining({ role: 'DOCTOR' }),
    });
  });

  it('should reject when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute(userId, { firstName: 'X' }, updatedBy, 'ADMIN')
    ).rejects.toThrow(/User/);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should reject an invalid role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(existingUser);

    await expect(
      useCase.execute(userId, { role: 'NOT_A_ROLE' }, updatedBy, 'ADMIN')
    ).rejects.toThrow('Invalid role');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should reject an invalid status', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(existingUser);

    await expect(
      useCase.execute(userId, { status: 'NOT_A_STATUS' }, updatedBy, 'ADMIN')
    ).rejects.toThrow('Invalid status');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should propagate unexpected errors', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('connection lost'));

    await expect(
      useCase.execute(userId, { firstName: 'X' }, updatedBy, 'ADMIN')
    ).rejects.toThrow('connection lost');
  });
});
