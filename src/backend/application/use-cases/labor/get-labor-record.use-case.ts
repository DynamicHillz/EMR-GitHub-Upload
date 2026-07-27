/**
 * Get Labor Record Use Case
 *
 * Fetches the labor record (with full observation history) for an
 * admission. Returns null rather than 404 when none exists yet, so the
 * frontend can cleanly render a "Start Labor Tracking" CTA.
 */

import { PrismaClient } from '@prisma/client';

export class GetLaborRecordUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, admissionId: string) {
    return this.prisma.laborRecord.findFirst({
      where: { tenantId, admissionId, isDeleted: false },
      include: {
        pregnancy: { select: { id: true, gravidity: true, parity: true, lmp: true, edd: true } },
        startedBy: { select: { firstName: true, lastName: true } },
        deliveredBy: { select: { firstName: true, lastName: true } },
        observations: {
          where: { isDeleted: false },
          orderBy: { recordedAt: 'asc' },
          include: { recordedBy: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  }
}
