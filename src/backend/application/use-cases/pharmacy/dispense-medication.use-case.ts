/**
 * Dispense Medication Use Case
 *
 * REQ-PHARM-2: Record medication dispensing with batch number, quantity, and expiration date
 * REQ-PHARM-3: Automatically deduct dispensed quantities from inventory
 * REQ-PHARM-7: Prevent dispensing if medication matches patient allergy
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { matchesDrugClassGroup } from '../../../shared/constants/drug-class-groups';
import { checkDrugInteractions } from '../../services/drug-interaction-checker.service';

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

    if (!Number.isInteger(dto.quantityDispensed) || dto.quantityDispensed <= 0) {
      throw new ValidationError('quantityDispensed must be a positive integer');
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

    // 2.5 Re-check drug interactions at dispense time (REQ-PHARM-6) — this
    // was previously only checked once, at prescribing time, and only ever
    // shown to the pharmacist as a UI warning they could click through with
    // no server-side gate at all. A CRITICAL interaction blocks the same
    // way an allergy does; lower severities remain advisory in the response.
    const interactionCheck = await checkDrugInteractions(
      this.prisma,
      tenantId,
      prescription.patientId,
      prescription.medicationName
    );

    if (interactionCheck.highestSeverity === 'CRITICAL') {
      throw new ValidationError(
        `CRITICAL DRUG INTERACTION: ${interactionCheck.interactionDetails.join('; ')}. Dispensing blocked.`
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

      // Deduct quantity from batch (REQ-PHARM-3) — guarded so two concurrent
      // dispenses against the same batch can't both pass the earlier
      // findFirst-based check and both decrement past zero.
      const batchUpdateResult = await tx.medicationBatch.updateMany({
        where: { id: dto.batchId, tenantId, quantity: { gte: dto.quantityDispensed } },
        data: {
          quantity: {
            decrement: dto.quantityDispensed,
          },
        },
      });
      if (batchUpdateResult.count === 0) {
        throw new ValidationError('Insufficient stock — it may have just been dispensed by another pharmacist');
      }

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

    if (interactionCheck.interactionWarning) {
      warnings.push(...interactionCheck.interactionDetails);
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
        interaction: interactionCheck.interactionWarning,
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

      // Check if medication name contains allergy or vice versa, or the two
      // fall in the same curated drug-class group (e.g. Penicillin -> Amoxicillin)
      if (
        medLower.includes(allergyLower) ||
        allergyLower.includes(medLower) ||
        matchesDrugClassGroup(allergy, medicationName)
      ) {
        matchingAllergies.push(allergy);
      }
    });

    return matchingAllergies;
  }
}
