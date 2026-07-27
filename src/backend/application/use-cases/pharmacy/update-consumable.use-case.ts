/**
 * Update Consumable Use Case
 *
 * Update an existing consumable's details.
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export class UpdateConsumableUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(id: string, tenantId: string, dto: any): Promise<any> {
    const existing = await this.prisma.consumable.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Consumable', id);
    }

    if (
      (dto.unitPrice !== undefined && dto.unitPrice < 0) ||
      (dto.reorderPoint !== undefined && dto.reorderPoint < 0)
    ) {
      throw new ValidationError('Unit price and reorder point must not be negative');
    }

    const consumable = await this.prisma.consumable.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        category: dto.category !== undefined ? dto.category || null : existing.category,
        unit: dto.unit || existing.unit,
        description: dto.description !== undefined ? dto.description || null : existing.description,
        reorderPoint: dto.reorderPoint !== undefined ? dto.reorderPoint : existing.reorderPoint,
        unitPrice: dto.unitPrice !== undefined ? dto.unitPrice : existing.unitPrice,
        // stockLevel is deliberately NOT settable here — see the identical
        // note in update-medication.use-case.ts; it should only move via
        // the batch system (add-consumable-batch.use-case.ts /
        // record-consumable-usage.use-case.ts).
      },
    });

    return consumable;
  }
}
