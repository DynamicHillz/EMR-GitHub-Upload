/**
 * Get License Status Use Case
 *
 * Reads the tenant's stored license token and derives a display-ready
 * status — backs both the Settings > License tab and the app-wide banner
 * shown to SUPER_ADMIN/ADMIN when the license needs attention.
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../shared/errors/AppError';
import { deriveLicenseStatus, LicenseStatusResult } from '../../../infrastructure/security/license.util';

export class GetLicenseStatusUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string): Promise<LicenseStatusResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { licenseToken: true },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    return deriveLicenseStatus(tenant.licenseToken);
  }
}
