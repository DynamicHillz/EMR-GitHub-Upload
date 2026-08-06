/**
 * Get Consumable Usage Use Case
 *
 * Lists consumable usage records, filterable by patient and billing status.
 * Powers both a usage-history view and GenerateInvoiceModal's fetch of
 * unbilled items for a patient.
 */

import { PrismaClient } from '@prisma/client';

export interface GetConsumableUsageFilters {
  patientId?: string;
  billingStatus?: 'UNBILLED' | 'BILLED';
  startDate?: Date;
  endDate?: Date;
}

export class GetConsumableUsageUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, filters: GetConsumableUsageFilters = {}) {
    // Only default-bound the tenant-wide usage-history view. A patientId
    // filter (GenerateInvoiceModal's fetch of one patient's unbilled items)
    // is inherently small and must never silently drop an old unbilled
    // record just because it predates a default window — that item would
    // then never get invoiced.
    const shouldDefaultBound = !filters.patientId && !filters.startDate && !filters.endDate;
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const records = await this.prisma.consumableUsage.findMany({
      where: {
        tenantId,
        isDeleted: false,
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.billingStatus ? { billingStatus: filters.billingStatus } : {}),
        ...(filters.startDate || filters.endDate || shouldDefaultBound
          ? {
              usedAt: {
                ...(filters.startDate ? { gte: filters.startDate } : shouldDefaultBound ? { gte: ninetyDaysAgo } : {}),
                ...(filters.endDate ? { lte: filters.endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        consumable: { select: { name: true, unit: true } },
        batch: { select: { batchNumber: true, sellingPrice: true } },
        recordedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { usedAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      consumableId: r.consumableId,
      consumableName: r.consumable.name,
      unit: r.consumable.unit,
      batchNumber: r.batch.batchNumber,
      unitPrice: Number(r.batch.sellingPrice),
      quantityUsed: r.quantityUsed,
      total: Number(r.batch.sellingPrice) * r.quantityUsed,
      patientId: r.patientId,
      admissionId: r.admissionId,
      consultationId: r.consultationId,
      billingStatus: r.billingStatus,
      notes: r.notes,
      usedAt: r.usedAt.toISOString(),
      recordedByName: `${r.recordedBy.firstName} ${r.recordedBy.lastName}`,
    }));
  }
}
