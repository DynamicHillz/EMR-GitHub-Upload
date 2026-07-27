/**
 * Get Consumable Inventory Use Case
 *
 * View consumable stock levels and batches (expiry, quantity).
 */

import { PrismaClient } from '@prisma/client';

export interface ConsumableInventoryItemDto {
  consumableId: string;
  consumableName: string;
  totalStock: number;
  reorderLevel: number;
  batches: {
    id: string;
    batchNumber: string;
    expiryDate: string | null;
    quantity: number;
    status: string;
    daysUntilExpiry: number | null;
  }[];
  lowStock: boolean;
  nearExpiry: boolean;
}

export class GetConsumableInventoryUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string): Promise<ConsumableInventoryItemDto[]> {
    const consumables = await this.prisma.consumable.findMany({
      where: { tenantId, isDeleted: false },
      include: {
        batches: {
          where: {
            status: 'ACTIVE',
            isDeleted: false,
          },
          orderBy: {
            expiryDate: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const now = new Date();

    return consumables.map((consumable) => {
      const batches = consumable.batches.map((batch) => {
        const daysUntilExpiry = batch.expiryDate
          ? Math.floor((batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          id: batch.id,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate ? batch.expiryDate.toISOString() : null,
          quantity: batch.quantity,
          status: batch.status,
          daysUntilExpiry,
        };
      });

      const lowStock = consumable.stockLevel <= consumable.reorderPoint;
      const nearExpiry = batches.some(
        (b) => b.daysUntilExpiry !== null && b.daysUntilExpiry >= 0 && b.daysUntilExpiry <= 30
      );

      return {
        consumableId: consumable.id,
        consumableName: consumable.name,
        totalStock: consumable.stockLevel,
        reorderLevel: consumable.reorderPoint,
        batches,
        lowStock,
        nearExpiry,
      };
    });
  }
}
