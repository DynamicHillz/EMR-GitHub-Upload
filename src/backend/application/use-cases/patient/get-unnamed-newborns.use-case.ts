/**
 * Get Unnamed Newborns Use Case
 *
 * Newborns registered at delivery (record-delivery-outcome.use-case.ts)
 * still carry their placeholder identity — firstName "Baby" and a synthetic
 * `NEWBORN-XXXXXXXX` phone — until staff rename them once the birth is
 * formally registered. Without a worklist for this, these are easy to
 * forget entirely. The synthetic phone prefix is a deterministic marker,
 * so no separate "is this a placeholder" flag is needed on Patient itself.
 */

import { PrismaClient } from '@prisma/client';

export class GetUnnamedNewbornsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, options?: { limit?: number; skip?: number }) {
    const where = { tenantId, isDeleted: false, phone: { startsWith: 'NEWBORN-' } } as const;

    const [newborns, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        select: {
          id: true,
          patientId: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          createdAt: true,
          mother: { select: { id: true, patientId: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: options?.limit,
        skip: options?.skip,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { newborns, total };
  }
}
