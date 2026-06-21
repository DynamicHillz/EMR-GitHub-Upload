/**
 * Update Tenant Branding Use Case
 *
 * Handles updating clinic branding (logo, colors, theme)
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { UpdateBrandingDto } from '../../dtos/tenant/UpdateBranding.dto';

export class UpdateBrandingUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, dto: UpdateBrandingDto) {
    // Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    // Validate color formats (hex colors)
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

    if (dto.primaryColor && !hexColorRegex.test(dto.primaryColor)) {
      throw new ValidationError('Primary color must be a valid hex color (e.g., #3b82f6)');
    }

    if (dto.secondaryColor && !hexColorRegex.test(dto.secondaryColor)) {
      throw new ValidationError('Secondary color must be a valid hex color (e.g., #10b981)');
    }

    if (dto.accentColor && !hexColorRegex.test(dto.accentColor)) {
      throw new ValidationError('Accent color must be a valid hex color (e.g., #f59e0b)');
    }

    // Update tenant branding
    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        clinicName: dto.clinicName || tenant.clinicName,
        address: dto.address !== undefined ? dto.address : tenant.address,
        logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : tenant.logoUrl,
        primaryColor: dto.primaryColor || tenant.primaryColor,
        secondaryColor: dto.secondaryColor || tenant.secondaryColor,
        accentColor: dto.accentColor || tenant.accentColor,
        fontFamily: dto.fontFamily || tenant.fontFamily
      },
      select: {
        id: true,
        name: true,
        clinicName: true,
        address: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        fontFamily: true,
        updatedAt: true
      }
    });

    return updatedTenant;
  }
}
