/**
 * Create User Use Case Tests
 */

import { CreateUserUseCase } from './create-user.use-case';
import { HashService } from '../../../infrastructure/services/hash.service';
import { EmailService } from '../../../infrastructure/services/email.service';
import { CreateUserDto } from '../../dtos/user/CreateUser.dto';

jest.mock('../../../infrastructure/services/hash.service');
jest.mock('../../../infrastructure/services/email.service');

describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let mockPrisma: any;

  const createdBy = 'admin-uuid-1';

  const validDto: CreateUserDto = {
    email: 'newuser@clinic.test',
    password: 'StrongPass1!',
    firstName: 'John',
    lastName: 'Doe',
    phone: '08012345678',
    role: 'NURSE',
    tenantId: 'tenant-1',
    sendWelcomeEmail: false,
  };

  const mockCreatedUser = {
    id: 'user-uuid-2',
    tenantId: validDto.tenantId,
    email: validDto.email,
    firstName: validDto.firstName,
    lastName: validDto.lastName,
    phone: validDto.phone,
    role: validDto.role,
    status: 'ACTIVE',
    lastLogin: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    (HashService.hash as jest.Mock).mockResolvedValue('hashed-password');
    (EmailService.sendWelcomeEmail as jest.Mock).mockResolvedValue(undefined);

    useCase = new CreateUserUseCase(mockPrisma);
  });

  it('should create a user with a hashed password and log the creation', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(mockCreatedUser);

    const result = await useCase.execute(validDto, createdBy);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { tenantId_email: { tenantId: validDto.tenantId, email: validDto.email } },
    });
    expect(HashService.hash).toHaveBeenCalledWith(validDto.password);
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: validDto.tenantId,
        email: validDto.email,
        password: 'hashed-password',
        firstName: validDto.firstName,
        lastName: validDto.lastName,
        phone: validDto.phone,
        role: validDto.role,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        requirePasswordChange: true,
      }),
    });
    expect(EmailService.sendWelcomeEmail).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: createdBy,
          tenantId: mockCreatedUser.tenantId,
          action: 'USER_CREATED',
          entityType: 'USER',
          entityId: mockCreatedUser.id,
        }),
      })
    );
    expect(result).toEqual({
      id: mockCreatedUser.id,
      email: mockCreatedUser.email,
      firstName: mockCreatedUser.firstName,
      lastName: mockCreatedUser.lastName,
      phone: mockCreatedUser.phone,
      role: mockCreatedUser.role,
      status: mockCreatedUser.status,
      tenantId: mockCreatedUser.tenantId,
      lastLogin: undefined,
      createdAt: mockCreatedUser.createdAt,
      updatedAt: mockCreatedUser.updatedAt,
    });
  });

  it('should send a welcome email with the temporary password when requested', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(mockCreatedUser);

    await useCase.execute({ ...validDto, sendWelcomeEmail: true }, createdBy);

    expect(EmailService.sendWelcomeEmail).toHaveBeenCalledWith(
      mockCreatedUser.email,
      mockCreatedUser.firstName,
      validDto.password
    );
  });

  it('should reject an invalid email format before touching the database', async () => {
    await expect(
      useCase.execute({ ...validDto, email: 'not-an-email' }, createdBy)
    ).rejects.toThrow('Invalid email format');

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('should reject a weak password with the combined validation errors', async () => {
    await expect(
      useCase.execute({ ...validDto, password: 'weak' }, createdBy)
    ).rejects.toThrow(/Password must/);

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('should reject an invalid role', async () => {
    await expect(
      useCase.execute({ ...validDto, role: 'NOT_A_REAL_ROLE' }, createdBy)
    ).rejects.toThrow('Invalid role');

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('should reject when the email is already registered for the tenant', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(useCase.execute(validDto, createdBy)).rejects.toThrow('Email already registered');

    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('should propagate unexpected errors', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute(validDto, createdBy)).rejects.toThrow('connection lost');
  });
});
