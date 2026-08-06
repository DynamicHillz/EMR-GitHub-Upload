/**
 * Get DHIS2 Sync History Use Case
 *
 * Past DHIS2 push attempts for a tenant, most recent first — every attempt
 * is logged (see Dhis2SyncLog), so this is the answer to "did we already
 * submit this period" and "why did the last push fail."
 */

import { PrismaClient } from '@prisma/client';

export class GetDhis2SyncHistoryUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, limit?: number) {
    return this.prisma.dhis2SyncLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit ?? 20,
      include: {
        triggeredBy: { select: { firstName: true, lastName: true } },
      },
    });
  }
}
