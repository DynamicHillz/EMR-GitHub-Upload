/**
 * Add Medication Batch Use Case
 *
 * REQ-PHARM-4: Add new medication batches to inventory
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '../../../shared/errors/AppError';

export interface AddMedicationBatchDto {
  medicationId: string;
  batchNumber: string;
  expiryDate: Date;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
  supplier?: string;
  purchaseDate?: Date;
}

export interface MedicationBatchResponse {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  medicationName: string;
}

export class AddMedicationBatchUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    dto: AddMedicationBatchDto,
    tenantId: string
  ): Promise<MedicationBatchResponse> {
    // The client only enforces `min` via HTML on the add-batch form — an
    // already-authorized PHARMACIST/ADMIN calling the API directly could
    // otherwise submit a negative sellingPrice, which flows straight into
    // generate-invoice.use-case.ts's pricing and produces a negative line
    // item.
    if (dto.quantity < 0 || dto.unitCost < 0 || dto.sellingPrice < 0) {
      throw new ValidationError('Quantity, unit cost, and selling price must not be negative');
    }

    // Verify medication exists
    const medication = await this.prisma.medication.findFirst({
      where: {
        id: dto.medicationId,
        tenantId,
      },
    });

    if (!medication) {
      throw new NotFoundError('Medication', dto.medicationId);
    }

    // Check for duplicate batch number
    const existingBatch = await this.prisma.medicationBatch.findFirst({
      where: {
        tenantId,
        medicationId: dto.medicationId,
        batchNumber: dto.batchNumber,
      },
    });

    if (existingBatch) {
      throw new ConflictError(
        `Batch number ${dto.batchNumber} already exists for this medication`
      );
    }

    // Create batch in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create medication batch
      const batch = await tx.medicationBatch.create({
        data: {
          tenantId,
          medicationId: dto.medicationId,
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

      // Update medication total stock level
      await tx.medication.update({
        where: { id: dto.medicationId },
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
      expiryDate: result.expiryDate.toISOString(),
      quantity: result.quantity,
      medicationName: medication.name,
    };
  }
}
