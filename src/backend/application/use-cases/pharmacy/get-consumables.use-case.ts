/**
 * Get Consumables Use Case
 *
 * Retrieve list of all consumables for dropdown/selection.
 */

import { PrismaClient } from '@prisma/client';

export interface ConsumableDto {
  id: string;
  name: string;
  category?: string;
  unit: string;
  description?: string;
  unitPrice: number;
  reorderPoint: number;
  stockLevel: number;
}

export class GetConsumablesUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string): Promise<ConsumableDto[]> {
    const consumables = await this.prisma.consumable.findMany({
      where: { tenantId, isDeleted: false },
      select: {
        id: true,
        name: true,
        category: true,
        unit: true,
        description: true,
        unitPrice: true,
        reorderPoint: true,
        stockLevel: true,
      },
      orderBy: { name: 'asc' },
    });

    return consumables.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category || undefined,
      unit: c.unit,
      description: c.description || undefined,
      unitPrice: Number(c.unitPrice),
      reorderPoint: c.reorderPoint,
      stockLevel: c.stockLevel,
    }));
  }
}
