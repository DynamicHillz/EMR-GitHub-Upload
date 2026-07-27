/**
 * Create Tenant Use Case
 *
 * Onboards a new clinic (tenant) plus its first ADMIN user in a single
 * transaction — the in-app replacement for scripts/final-create-admin.js,
 * which did the equivalent via raw SQL outside the application.
 */

import { PrismaClient } from '@prisma/client';
import { HashService } from '../../../infrastructure/services/hash.service';
import { UserService } from '../../../domain/services/user.service';
import { logger } from '../../../config/logger';
import { ValidationError, ConflictError } from '../../../shared/errors/AppError';
import { CreateTenantDto, CreateTenantResponseDto } from '../../dtos/tenant/CreateTenant.dto';

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class CreateTenantUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: CreateTenantDto, createdBy: string): Promise<CreateTenantResponseDto> {
    if (!dto.name?.trim()) {
      throw new ValidationError('Clinic name is required');
    }
    if (!dto.slug || !SLUG_REGEX.test(dto.slug)) {
      throw new ValidationError('Slug must be lowercase letters, numbers, and hyphens only (e.g. "st-stephen-clinic")');
    }
    if (!dto.clinicName?.trim()) {
      throw new ValidationError('Clinic display name is required');
    }
    if (!UserService.validateEmail(dto.adminEmail)) {
      throw new ValidationError('Invalid admin email format');
    }
    const passwordValidation = UserService.validatePassword(dto.adminPassword);
    if (!passwordValidation.valid) {
      throw new ValidationError(passwordValidation.errors.join('. '));
    }
    if (!dto.adminFirstName?.trim() || !dto.adminLastName?.trim()) {
      throw new ValidationError('Admin first and last name are required');
    }

    const existingSlug = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) {
      throw new ConflictError('A tenant with this slug already exists');
    }

    const hashedPassword = await HashService.hash(dto.adminPassword);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          clinicName: dto.clinicName,
          address: dto.address,
          phone: dto.phone,
          email: dto.email,
          licenseNumber: dto.licenseNumber,
          subscriptionTier: dto.subscriptionTier || 'BASIC',
          status: 'ACTIVE',
        },
      });

      const admin = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.adminEmail,
          password: hashedPassword,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          phone: dto.adminPhone,
          role: 'ADMIN',
          status: 'ACTIVE',
          failedLoginAttempts: 0,
          // @ts-ignore - Temporary fix for schema alignment (matches create-user.use-case.ts)
          requirePasswordChange: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: createdBy,
          tenantId: tenant.id,
          action: 'TENANT_CREATED',
          entityType: 'TENANT',
          entityId: tenant.id,
          metadata: JSON.stringify({
            name: tenant.name,
            slug: tenant.slug,
            adminEmail: admin.email,
            createdBy,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      return { tenant, admin };
    });

    logger.info(`Tenant created: ${result.tenant.slug} by ${createdBy}`);

    return {
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        clinicName: result.tenant.clinicName,
        status: result.tenant.status,
        subscriptionTier: result.tenant.subscriptionTier,
        createdAt: result.tenant.createdAt,
      },
      admin: {
        id: result.admin.id,
        email: result.admin.email,
        firstName: result.admin.firstName,
        lastName: result.admin.lastName,
        role: result.admin.role,
      },
    };
  }
}
