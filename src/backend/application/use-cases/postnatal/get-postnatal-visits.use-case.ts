/**
 * Get Postnatal Visits Use Case
 *
 * Visit history for one mother (optionally scoped to one pregnancy),
 * newest first — same shape as get-labor-record's observation history.
 */

import { PrismaClient } from '@prisma/client';

export class GetPostnatalVisitsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, patientId: string, pregnancyId?: string) {
    return this.prisma.postnatalVisit.findMany({
      where: { tenantId, patientId, isDeleted: false, ...(pregnancyId ? { pregnancyId } : {}) },
      orderBy: { visitDate: 'desc' },
      include: {
        recordedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }
}
