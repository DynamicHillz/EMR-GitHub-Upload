/**
 * Update Medication Use Case
 *
 * Update an existing medication's details.
 */

import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../../shared/errors/AppError';

export class UpdateMedicationUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(id: string, tenantId: string, dto: any): Promise<any> {
    const existing = await this.prisma.medication.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existing) {
      throw new Error('Medication not found');
    }

    if (dto.unitPrice < 0 || (dto.reorderPoint !== undefined && dto.reorderPoint < 0)) {
      throw new ValidationError('Unit price and reorder point must not be negative');
    }

    const medication = await this.prisma.medication.update({
      where: { id },
      data: {
        name: dto.name,
        genericName: dto.genericName || null,
        brandName: dto.brandName || null,
        activeIngredient: dto.activeIngredient || null,
        category: dto.category || null,
        dosageForm: dto.dosageForm || existing.dosageForm,
        strength: dto.strength || existing.strength,
        drugClass: dto.drugClass || null,
        reorderPoint: dto.reorderPoint || 10,
        unitPrice: dto.unitPrice,
        // stockLevel is deliberately NOT settable here — it should only ever
        // move via the batch system (add-medication-batch.use-case.ts
        // increments it, dispense-medication.use-case.ts decrements it).
        // Letting it be overwritten directly desyncs it from what the
        // batches actually contain, corrupting low-stock alerts.
        // @ts-ignore - Temporary fix for schema alignment
        whoAtcCode: dto.whoAtcCode !== undefined ? dto.whoAtcCode : existing.whoAtcCode,
        // @ts-ignore - Temporary fix for schema alignment
        isEssentialMedicine: dto.isEssentialMedicine !== undefined ? dto.isEssentialMedicine : existing.isEssentialMedicine,
      },
    });

    return medication;
  }
}
