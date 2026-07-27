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
}

export class GetConsumableUsageUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, filters: GetConsumableUsageFilters = {}) {
    const records = await this.prisma.consumableUsage.findMany({
      where: {
        tenantId,
        isDeleted: false,
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.billingStatus ? { billingStatus: filters.billingStatus } : {}),
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
