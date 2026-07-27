/**
 * Get Stock Turnover Report Use Case
 *
 * Per medication: quantity dispensed in a date range vs. current on-hand
 * quantity across ACTIVE batches. turnoverRatio = dispensed / currentStock
 * (null when there's no stock on hand to divide by). Not a true received-vs-
 * dispensed formula — original received quantity isn't preserved once a
 * batch starts being dispensed against.
 */

import { PrismaClient } from '@prisma/client';
import { RankingReportFilters } from './get-diagnosis-trends-report.use-case';

interface MedicationAccumulator {
  medicationId: string;
  name: string;
  category: string | null;
  quantityDispensed: number;
}

export class GetStockTurnoverReportUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, filters: RankingReportFilters) {
    const limit = filters.limit || 10;

    const dispensings = await this.prisma.dispensingRecord.findMany({
      where: { tenantId, isDeleted: false, dispensedAt: { gte: filters.startDate, lte: filters.endDate } },
      select: {
        quantityDispensed: true,
        batch: { select: { medicationId: true, medication: { select: { name: true, category: true } } } },
      },
    });

    const dispensedMap = new Map<string, MedicationAccumulator>();
    for (const d of dispensings) {
      const medicationId = d.batch.medicationId;
      let entry = dispensedMap.get(medicationId);
      if (!entry) {
        entry = {
          medicationId,
          name: d.batch.medication.name,
          category: d.batch.medication.category,
          quantityDispensed: 0,
        };
        dispensedMap.set(medicationId, entry);
      }
      entry.quantityDispensed += d.quantityDispensed;
    }

    const medicationIds = Array.from(dispensedMap.keys());
    const batches = medicationIds.length
      ? await this.prisma.medicationBatch.findMany({
          where: { tenantId, isDeleted: false, status: 'ACTIVE', medicationId: { in: medicationIds } },
          select: { medicationId: true, quantity: true },
        })
      : [];

    const stockByMedication = new Map<string, number>();
    for (const b of batches) {
      stockByMedication.set(b.medicationId, (stockByMedication.get(b.medicationId) || 0) + b.quantity);
    }

    const medications = Array.from(dispensedMap.values())
      .map((m) => {
        const currentStock = stockByMedication.get(m.medicationId) || 0;
        return {
          ...m,
          currentStock,
          turnoverRatio: currentStock > 0 ? m.quantityDispensed / currentStock : null,
        };
      })
      .sort((a, b) => b.quantityDispensed - a.quantityDispensed)
      .slice(0, limit);

    return {
      medications,
      summary: {
        totalDispensed: dispensings.reduce((sum, d) => sum + d.quantityDispensed, 0),
        totalMedicationsTracked: dispensedMap.size,
      },
    };
  }
}
