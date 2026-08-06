/**
 * Update License Use Case
 *
 * Saves a new/renewal license token — rejected up front if it doesn't
 * verify, so a SUPER_ADMIN pasting a garbled or wrong-clinic token gets
 * immediate feedback instead of silently storing something unusable.
 */

import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../../shared/errors/AppError';
import { verifyLicenseToken } from '../../../infrastructure/security/license.util';

export class UpdateLicenseUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, licenseToken: string): Promise<void> {
    const claims = verifyLicenseToken(licenseToken);
    if (!claims) {
      throw new ValidationError(
        'This license token could not be verified. Double-check it was copied in full, or contact your vendor for a fresh one.'
      );
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { licenseToken },
    });
  }
}
