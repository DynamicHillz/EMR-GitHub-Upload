/**
 * Get Active Labors Use Case
 *
 * Clinic-wide "who's currently in labor" worklist, each row carrying its
 * most recent observation for a quick-glance dilation/FHR column.
 */

import { PrismaClient } from '@prisma/client';

export class GetActiveLaborsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string) {
    return this.prisma.laborRecord.findMany({
      where: { tenantId, status: 'IN_LABOR', isDeleted: false },
      include: {
        admission: {
          include: {
            patient: { select: { id: true, patientId: true, firstName: true, lastName: true } },
            bed: { include: { ward: { select: { name: true } } } },
          },
        },
        observations: {
          where: { isDeleted: false },
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { laborOnsetAt: 'asc' },
    });
  }
}
