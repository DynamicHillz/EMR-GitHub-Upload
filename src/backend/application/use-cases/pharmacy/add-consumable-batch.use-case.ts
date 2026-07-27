/**
 * Add Consumable Batch Use Case
 *
 * Add new stock (a batch) of a consumable to inventory.
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../../../shared/errors/AppError';

export interface AddConsumableBatchDto {
  consumableId: string;
  batchNumber: string;
  expiryDate?: Date;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
  supplier?: string;
  purchaseDate?: Date;
}

export interface ConsumableBatchResponse {
  id: string;
  batchNumber: string;
  expiryDate: string | null;
  quantity: number;
  consumableName: string;
}

export class AddConsumableBatchUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    dto: AddConsumableBatchDto,
    tenantId: string
  ): Promise<ConsumableBatchResponse> {
    if (dto.quantity < 0 || dto.unitCost < 0 || dto.sellingPrice < 0) {
      throw new ValidationError('Quantity, unit cost, and selling price must not be negative');
    }

    const consumable = await this.prisma.consumable.findFirst({
      where: {
        id: dto.consumableId,
        tenantId,
      },
    });

    if (!consumable) {
      throw new NotFoundError('Consumable', dto.consumableId);
    }

    const existingBatch = await this.prisma.consumableBatch.findFirst({
      where: {
        tenantId,
        consumableId: dto.consumableId,
        batchNumber: dto.batchNumber,
      },
    });

    if (existingBatch) {
      throw new ConflictError(
        `Batch number ${dto.batchNumber} already exists for this consumable`
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const batch = await tx.consumableBatch.create({
        data: {
          tenantId,
          consumableId: dto.consumableId,
          batchNumber: dto.batchNumber,
          expiryDate: dto.expiryDate,
          quantity: dto.quantity,
          unitCost: dto.unitCost,
          sellingPrice: dto.sellingPrice,
          supplier: dto.supplier,
          purchaseDate: dto.purchaseDate || new Date(),
          status: 'ACTIVE',
        },
      });

      await tx.consumable.update({
        where: { id: dto.consumableId },
        data: {
          stockLevel: {
            increment: dto.quantity,
          },
        },
      });

      return batch;
    });

    return {
      id: result.id,
      batchNumber: result.batchNumber,
      expiryDate: result.expiryDate ? result.expiryDate.toISOString() : null,
      quantity: result.quantity,
      consumableName: consumable.name,
    };
  }
}
