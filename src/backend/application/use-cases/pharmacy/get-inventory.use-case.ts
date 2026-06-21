/**
 * Get Inventory Use Case
 *
 * REQ-PHARM-4: View and manage medication inventory
 */

import { PrismaClient } from '@prisma/client';

export interface InventoryItemDto {
  medicationId: string;
  medicationName: string;
  totalStock: number;
  reorderLevel: number;
  batches: {
    id: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    status: string;
    daysUntilExpiry: number;
  }[];
  lowStock: boolean;
  nearExpiry: boolean;
}

export class GetInventoryUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string): Promise<InventoryItemDto[]> {
    // Get all medications with their batches
    const medications = await this.prisma.medication.findMany({
      where: { tenantId },
      include: {
        batches: {
          where: {
            status: 'ACTIVE',
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

    return medications.map((medication) => {
      const batches = medication.batches.map((batch) => {
        const daysUntilExpiry = Math.floor(
          (batch.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          id: batch.id,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate.toISOString(),
          quantity: batch.quantity,
          status: batch.status,
          daysUntilExpiry,
        };
      });

      const lowStock = medication.stockLevel <= medication.reorderPoint;
      const nearExpiry = batches.some((b) => b.daysUntilExpiry >= 0 && b.daysUntilExpiry <= 30);

      return {
        medicationId: medication.id,
        medicationName: medication.name,
        totalStock: medication.stockLevel,
        reorderLevel: medication.reorderPoint,
        batches,
        lowStock,
        nearExpiry,
      };
    });
  }
}
