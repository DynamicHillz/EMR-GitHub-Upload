/**
 * Get Tenant Branding Use Case
 *
 * Retrieves clinic branding settings
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../shared/errors/AppError';

export class GetBrandingUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        clinicName: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        fontFamily: true,
        address: true,
        phone: true,
        email: true,
        taxId: true,
        taxName: true
      }
    });

    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    return tenant;
  }
}
