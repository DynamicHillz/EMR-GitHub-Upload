/**
 * Add Consumable Use Case
 *
 * Add a new non-drug consumable (syringes, gloves, gauze, cannula, etc.)
 * to the pharmacy's inventory.
 */

import { PrismaClient } from '@prisma/client';
import { ConflictError, ValidationError } from '../../../shared/errors/AppError';

export interface AddConsumableDto {
  name: string;
  category?: string;
  unit?: string;
  description?: string;
  reorderPoint?: number;
  unitPrice: number;
  stockLevel?: number;
}

export class AddConsumableUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: AddConsumableDto, tenantId: string) {
    if (dto.unitPrice < 0 || (dto.stockLevel !== undefined && dto.stockLevel < 0) || (dto.reorderPoint !== undefined && dto.reorderPoint < 0)) {
      throw new ValidationError('Unit price, stock level, and reorder point must not be negative');
    }

    const existing = await this.prisma.consumable.findFirst({
      where: {
        tenantId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictError('Consumable with this name already exists');
    }

    const consumable = await this.prisma.consumable.create({
      data: {
        tenantId,
        name: dto.name,
        category: dto.category || undefined,
        unit: dto.unit || 'piece',
        description: dto.description || undefined,
        stockLevel: dto.stockLevel ?? 0,
        reorderPoint: dto.reorderPoint || 10,
        unitPrice: dto.unitPrice,
      },
    });

    return consumable;
  }
}
