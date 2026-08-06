/**
 * Check Drug Interactions Use Case
 *
 * REQ-PHARM-6: Check for drug interactions before dispensing
 *
 * Delegates to the shared findInteractionRecords helper (also used by
 * create-prescription/dispense-medication) instead of reimplementing the
 * "active medication" query and name-matching logic here — a prior
 * standalone version diverged (exact-match only, DISPENSED-in-last-30-days
 * only) from the check that actually gates dispensing, so this advisory
 * pre-dispense banner could under-report relative to the real block.
 */

import { PrismaClient } from '@prisma/client';
import { findInteractionRecords } from '../../services/drug-interaction-checker.service';

export interface DrugInteractionCheckDto {
  patientId: string;
  medicationName: string;
}

export interface DrugInteractionResult {
  hasInteractions: boolean;
  interactions: {
    drug1: string;
    drug2: string;
    severity: string;
    description: string;
    clinicalEffect?: string;
    management?: string;
  }[];
}

export class CheckDrugInteractionsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    dto: DrugInteractionCheckDto,
    tenantId: string
  ): Promise<DrugInteractionResult> {
    const records = await findInteractionRecords(this.prisma, tenantId, dto.patientId, dto.medicationName);

    const interactions = records.map((interaction) => ({
      drug1: interaction.drug1,
      drug2: interaction.drug2,
      severity: interaction.severity,
      description: interaction.description,
      clinicalEffect: interaction.clinicalEffect || undefined,
      management: interaction.management || undefined,
    }));

    return {
      hasInteractions: interactions.length > 0,
      interactions,
    };
  }
}
