/**
 * Get DHIS2 Config Use Case
 *
 * Returns a tenant's DHIS2 integration settings — deliberately never the
 * password itself (unlike the payment-gateway secrets pattern, which does
 * return raw secrets from its GET). `dhis2PasswordSet` lets the UI show
 * "configured" without the plaintext ever leaving the server again.
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../shared/errors/AppError';

export class GetDhis2ConfigUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        dhis2Enabled: true,
        dhis2BaseUrl: true,
        dhis2Username: true,
        dhis2Password: true,
        dhis2OrgUnitId: true,
        dhis2DataElementTotalVisits: true,
        dhis2DataElementPediatricUnder5: true,
        dhis2DataElementSevereMalnutrition: true,
        dhis2DataElementLiveBirths: true,
        dhis2DataElementSeverePostpartumHemorrhage: true,
        dhis2CategoryOptionCombo: true,
      },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    const { dhis2Password, ...rest } = tenant;
    return { ...rest, dhis2PasswordSet: !!dhis2Password };
  }
}
