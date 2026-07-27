/**
 * Create Tenant Use Case Tests
 *
 * Covers every explicit validation branch (name/slug/clinicName/admin
 * email/password/name), the slug-uniqueness conflict check, and the
 * tenant+admin creation transaction.
 */

import { CreateTenantUseCase } from './create-tenant.use-case';
import { HashService } from '../../../infrastructure/services/hash.service';
import { CreateTenantDto } from '../../dtos/tenant/CreateTenant.dto';

jest.mock('../../../infrastructure/services/hash.service');

describe('CreateTenantUseCase', () => {
  let useCase: CreateTenantUseCase;
  let mockPrisma: any;
  let txMock: any;

  const createdBy = 'super-admin-uuid-1';

  const validDto: CreateTenantDto = {
    name: 'St Stephen Clinic',
    slug: 'st-stephen-clinic',
    clinicName: 'St Stephen Medical Center',
    adminEmail: 'admin@clinic.test',
    adminPassword: 'StrongPass1!',
    adminFirstName: 'Jane',
    adminLastName: 'Doe',
  };

  const mockTenant = {
    id: 'tenant-uuid-1',
    name: validDto.name,
    slug: validDto.slug,
    clinicName: validDto.clinicName,
    status: 'ACTIVE',
    subscriptionTier: 'BASIC',
    createdAt: new Date('2026-07-27T00:00:00.000Z'),
  };

  const mockAdmin = {
    id: 'admin-uuid-1',
    email: validDto.adminEmail,
    firstName: validDto.adminFirstName,
    lastName: validDto.adminLastName,
    role: 'ADMIN',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    txMock = {
      tenant: { create: jest.fn().mockResolvedValue(mockTenant) },
      user: { create: jest.fn().mockResolvedValue(mockAdmin) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    mockPrisma = {
      tenant: { findUnique: jest.fn() },
      $transaction: jest.fn(async (callback: any) => callback(txMock)),
    };

    (HashService.hash as jest.Mock).mockResolvedValue('hashed-password');

    useCase = new CreateTenantUseCase(mockPrisma);
  });

  it('should create the tenant and its first admin user for valid input', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    const result = await useCase.execute(validDto, createdBy);

    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({ where: { slug: validDto.slug } });
    expect(HashService.hash).toHaveBeenCalledWith(validDto.adminPassword);
    expect(txMock.tenant.create).toHaveBeenCalledWith({
      data: {
        name: validDto.name,
        slug: validDto.slug,
        clinicName: validDto.clinicName,
        address: undefined,
        phone: undefined,
        email: undefined,
        licenseNumber: undefined,
        subscriptionTier: 'BASIC',
        status: 'ACTIVE',
      },
    });
    expect(txMock.user.create).toHaveBeenCalledWith({
      data: {
        tenantId: mockTenant.id,
        email: validDto.adminEmail,
        password: 'hashed-password',
        firstName: validDto.adminFirstName,
        lastName: validDto.adminLastName,
        phone: undefined,
        role: 'ADMIN',
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        requirePasswordChange: true,
      },
    });
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: createdBy,
          tenantId: mockTenant.id,
          action: 'TENANT_CREATED',
          entityType: 'TENANT',
          entityId: mockTenant.id,
        }),
      })
    );
    expect(result).toEqual({
      tenant: {
        id: mockTenant.id,
        name: mockTenant.name,
        slug: mockTenant.slug,
        clinicName: mockTenant.clinicName,
        status: mockTenant.status,
        subscriptionTier: mockTenant.subscriptionTier,
        createdAt: mockTenant.createdAt,
      },
      admin: {
        id: mockAdmin.id,
        email: mockAdmin.email,
        firstName: mockAdmin.firstName,
        lastName: mockAdmin.lastName,
        role: mockAdmin.role,
      },
    });
  });

  it('should honor an explicit subscriptionTier instead of defaulting to BASIC', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await useCase.execute({ ...validDto, subscriptionTier: 'PREMIUM' }, createdBy);

    expect(txMock.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionTier: 'PREMIUM' }) })
    );
  });

  it('should reject a missing/blank clinic name', async () => {
    await expect(useCase.execute({ ...validDto, name: '   ' }, createdBy)).rejects.toThrow(
      'Clinic name is required'
    );
    expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('should reject a slug with invalid characters', async () => {
    await expect(useCase.execute({ ...validDto, slug: 'Not A Slug!' }, createdBy)).rejects.toThrow(
      'Slug must be lowercase letters, numbers, and hyphens only'
    );
  });

  it('should reject a missing slug', async () => {
    await expect(useCase.execute({ ...validDto, slug: '' }, createdBy)).rejects.toThrow(
      'Slug must be lowercase letters, numbers, and hyphens only'
    );
  });

  it('should reject a missing/blank clinic display name', async () => {
    await expect(useCase.execute({ ...validDto, clinicName: '  ' }, createdBy)).rejects.toThrow(
      'Clinic display name is required'
    );
  });

  it('should reject an invalid admin email format', async () => {
    await expect(useCase.execute({ ...validDto, adminEmail: 'not-an-email' }, createdBy)).rejects.toThrow(
      'Invalid admin email format'
    );
  });

  it('should reject a weak admin password with the specific validation errors', async () => {
    await expect(useCase.execute({ ...validDto, adminPassword: 'short' }, createdBy)).rejects.toThrow(
      /Password must be at least 8 characters long/
    );
  });

  it('should reject a missing admin first or last name', async () => {
    await expect(
      useCase.execute({ ...validDto, adminFirstName: '', adminLastName: '' }, createdBy)
    ).rejects.toThrow('Admin first and last name are required');
  });

  it('should reject when the slug is already taken', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'existing-tenant', slug: validDto.slug });

    await expect(useCase.execute(validDto, createdBy)).rejects.toThrow(
      'A tenant with this slug already exists'
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
