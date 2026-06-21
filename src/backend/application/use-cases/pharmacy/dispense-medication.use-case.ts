/**
 * Dispense Medication Use Case
 *
 * REQ-PHARM-2: Record medication dispensing with batch number, quantity, and expiration date
 * REQ-PHARM-3: Automatically deduct dispensed quantities from inventory
 * REQ-PHARM-7: Prevent dispensing if medication matches patient allergy
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export interface DispenseMedicationDto {
  prescriptionId: string;
  batchId: string;
  quantityDispensed: number;
  pharmacistNotes?: string;
}

export interface DispenseMedicationResponse {
  id: string;
  prescriptionId: string;
  dispensedAt: string;
  batchNumber: string;
  expiryDate: string;
  labelUrl?: string;
  warnings: {
    allergy: boolean;
    interaction: boolean;
    details: string[];
  };
}

export class DispenseMedicationUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    dto: DispenseMedicationDto,
    pharmacistId: string,
    tenantId: string
  ): Promise<DispenseMedicationResponse> {
    // 1. Get prescription with patient and medication batch info
    const prescription = await this.prisma.prescription.findFirst({
      where: {
        id: dto.prescriptionId,
        tenantId,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            allergies: true,
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundError('Prescription', dto.prescriptionId);
    }

    if (prescription.status !== 'PENDING') {
      throw new ValidationError(`Cannot dispense prescription with status: ${prescription.status}`);
    }

    // 2. Verify patient allergies (REQ-PHARM-7)
    const allergyWarnings = this.checkForAllergies(
      prescription.medicationName,
      prescription.patient.allergies || []
    );

    if (allergyWarnings.length > 0) {
      throw new ValidationError(
        `ALLERGY WARNING: Patient is allergic to ${allergyWarnings.join(', ')}. Dispensing blocked.`
      );
    }

    // 3. Get batch and verify availability
    const batch = await this.prisma.medicationBatch.findFirst({
      where: {
        id: dto.batchId,
        tenantId,
        status: 'ACTIVE',
      },
      include: {
        medication: true,
      },
    });

    if (!batch) {
      throw new NotFoundError('MedicationBatch', dto.batchId);
    }

    // Check if batch has expired
    if (batch.expiryDate < new Date()) {
      throw new ValidationError(`Batch ${batch.batchNumber} has expired`);
    }

    // Check if sufficient quantity available
    if (batch.quantity < dto.quantityDispensed) {
      throw new ValidationError(
        `Insufficient stock. Available: ${batch.quantity}, Required: ${dto.quantityDispensed}`
      );
    }

    // 4. Perform dispensing in transaction (REQ-PHARM-2, REQ-PHARM-3)
    const result = await this.prisma.$transaction(async (tx) => {
      // Create dispensing record
      const dispensingRecord = await tx.dispensingRecord.create({
        data: {
          tenantId,
          prescriptionId: dto.prescriptionId,
          batchId: dto.batchId,
          pharmacistId,
          quantityDispensed: dto.quantityDispensed,
          pharmacistNotes: dto.pharmacistNotes,
          labelGenerated: false,
        },
      });

      // Deduct quantity from batch (REQ-PHARM-3)
      await tx.medicationBatch.update({
        where: { id: dto.batchId },
        data: {
          quantity: {
            decrement: dto.quantityDispensed,
          },
        },
      });

      // Update medication total stock
      await tx.medication.update({
        where: { id: batch.medicationId },
        data: {
          stockLevel: {
            decrement: dto.quantityDispensed,
          },
        },
      });

      // Update prescription status
      await tx.prescription.update({
        where: { id: dto.prescriptionId },
        data: {
          status: 'DISPENSED',
          dispensedAt: new Date(),
          dispensedBy: pharmacistId,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
        },
      });

      return { dispensingRecord, batch };
    });

    // 5. Return response with warnings
    const warnings: string[] = [];

    if (prescription.allergyWarning) {
      warnings.push('Allergy warning flagged during prescription');
    }

    if (prescription.interactionWarning) {
      warnings.push('Drug interaction warning flagged');
    }

    return {
      id: result.dispensingRecord.id,
      prescriptionId: dto.prescriptionId,
      dispensedAt: result.dispensingRecord.dispensedAt.toISOString(),
      batchNumber: result.batch.batchNumber,
      expiryDate: result.batch.expiryDate.toISOString(),
      labelUrl: result.dispensingRecord.labelUrl || undefined,
      warnings: {
        allergy: prescription.allergyWarning,
        interaction: prescription.interactionWarning,
        details: warnings,
      },
    };
  }

  private checkForAllergies(medicationName: string, allergies: string[]): string[] {
    if (!allergies || allergies.length === 0) {
      return [];
    }

    const medLower = medicationName.toLowerCase();
    const matchingAllergies: string[] = [];

    allergies.forEach((allergy) => {
      const allergyLower = allergy.toLowerCase();

      // Check if medication name contains allergy or vice versa
      if (medLower.includes(allergyLower) || allergyLower.includes(medLower)) {
        matchingAllergies.push(allergy);
      }
    });

    return matchingAllergies;
  }
}
