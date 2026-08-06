/**
 * Record Consumable Usage Use Case
 *
 * Single-step usage logging for non-drug supplies (syringes, gloves, gauze,
 * cannula, etc.) — unlike medications, consumables don't need a doctor's
 * prescription or a separate dispense step: a pharmacist or nurse just logs
 * that N units were used on a patient. This both deducts stock and creates
 * an UNBILLED charge for invoice generation to pick up later.
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export interface RecordConsumableUsageDto {
  patientId: string;
  consumableId: string;
  batchId: string;
  quantityUsed: number;
  admissionId?: string;
  consultationId?: string;
  notes?: string;
  // Oxygen-therapy detail — only meaningful when the consumable's category
  // is "Oxygen"; harmless if sent for anything else, just stored as-is.
  flowRateLpm?: number;
  deliveryMethod?: string;
  spO2Before?: number;
  spO2After?: number;
}

export class RecordConsumableUsageUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: RecordConsumableUsageDto, recordedById: string, tenantId: string) {
    if (!Number.isInteger(dto.quantityUsed) || dto.quantityUsed <= 0) {
      throw new ValidationError('quantityUsed must be a positive integer');
    }

    if (
      (dto.spO2Before !== undefined && (dto.spO2Before < 0 || dto.spO2Before > 100)) ||
      (dto.spO2After !== undefined && (dto.spO2After < 0 || dto.spO2After > 100))
    ) {
      throw new ValidationError('spO2Before/spO2After must be between 0 and 100');
    }

    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundError('Patient', dto.patientId);
    }

    if (dto.admissionId) {
      const admission = await this.prisma.admission.findFirst({
        where: { id: dto.admissionId, tenantId, patientId: dto.patientId },
      });
      if (!admission) {
        throw new NotFoundError('Admission', dto.admissionId);
      }
    }

    if (dto.consultationId) {
      const consultation = await this.prisma.consultation.findFirst({
        where: { id: dto.consultationId, tenantId, patientId: dto.patientId },
      });
      if (!consultation) {
        throw new NotFoundError('Consultation', dto.consultationId);
      }
    }

    const batch = await this.prisma.consumableBatch.findFirst({
      where: {
        id: dto.batchId,
        tenantId,
        consumableId: dto.consumableId,
        status: 'ACTIVE',
      },
      include: {
        consumable: true,
      },
    });

    if (!batch) {
      throw new NotFoundError('ConsumableBatch', dto.batchId);
    }

    if (batch.expiryDate && batch.expiryDate < new Date()) {
      throw new ValidationError(`Batch ${batch.batchNumber} has expired`);
    }

    if (batch.quantity < dto.quantityUsed) {
      throw new ValidationError(
        `Insufficient stock. Available: ${batch.quantity}, Required: ${dto.quantityUsed}`
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Guarded so two concurrent usage records against the same batch
      // can't both pass the earlier check and both decrement past zero.
      const batchUpdateResult = await tx.consumableBatch.updateMany({
        where: { id: dto.batchId, tenantId, quantity: { gte: dto.quantityUsed } },
        data: {
          quantity: {
            decrement: dto.quantityUsed,
          },
        },
      });
      if (batchUpdateResult.count === 0) {
        throw new ValidationError('Insufficient stock — it may have just been used by someone else');
      }

      await tx.consumable.update({
        where: { id: dto.consumableId },
        data: {
          stockLevel: {
            decrement: dto.quantityUsed,
          },
        },
      });

      const usage = await tx.consumableUsage.create({
        data: {
          tenantId,
          consumableId: dto.consumableId,
          batchId: dto.batchId,
          patientId: dto.patientId,
          recordedById,
          admissionId: dto.admissionId,
          consultationId: dto.consultationId,
          quantityUsed: dto.quantityUsed,
          notes: dto.notes,
          flowRateLpm: dto.flowRateLpm,
          deliveryMethod: dto.deliveryMethod,
          spO2Before: dto.spO2Before,
          spO2After: dto.spO2After,
          billingStatus: 'UNBILLED',
        },
      });

      return usage;
    });

    return {
      id: result.id,
      consumableName: batch.consumable.name,
      batchNumber: batch.batchNumber,
      quantityUsed: result.quantityUsed,
      usedAt: result.usedAt.toISOString(),
    };
  }
}
