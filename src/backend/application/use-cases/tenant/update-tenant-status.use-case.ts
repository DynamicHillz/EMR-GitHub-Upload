/**
 * Update Tenant Status Use Case
 *
 * Suspends/reactivates/deactivates a whole clinic. This is only meaningful
 * because login.use-case.ts and the auth middleware now check tenant.status
 * — see Phase 2.2 of the admin remediation plan.
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { logger } from '../../../config/logger';

const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'INACTIVE'];

export class UpdateTenantStatusUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, status: string, updatedBy: string) {
    if (!VALID_STATUSES.includes(status)) {
      throw new ValidationError(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: status as any },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        updatedAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: updatedBy,
        tenantId,
        action: 'TENANT_STATUS_CHANGED',
        entityType: 'TENANT',
        entityId: tenantId,
        oldValues: JSON.stringify({ status: tenant.status }),
        newValues: JSON.stringify({ status: updated.status }),
        metadata: JSON.stringify({ updatedBy, timestamp: new Date().toISOString() }),
      },
    });

    logger.info(`Tenant ${updated.slug} status changed: ${tenant.status} -> ${updated.status} by ${updatedBy}`);

    return updated;
  }
}
