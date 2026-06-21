/**
 * Check Drug Interactions Use Case
 *
 * REQ-PHARM-6: Check for drug interactions before dispensing
 */

import { PrismaClient } from '@prisma/client';

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
    // Get patient's current active prescriptions
    const activePrescriptions = await this.prisma.prescription.findMany({
      where: {
        tenantId,
        patientId: dto.patientId,
        status: 'DISPENSED',
        // Consider prescriptions from the last 30 days as active
        dispensedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        medicationName: true,
      },
    });

    const currentMedications = activePrescriptions.map((p) => p.medicationName);
    const interactions: DrugInteractionResult['interactions'] = [];

    // Check for interactions with each current medication
    for (const currentMed of currentMedications) {
      // Check both directions: new drug with current, and current with new drug
      const potentialInteractions = await this.prisma.drugInteraction.findMany({
        where: {
          OR: [
            {
              drug1: {
                equals: dto.medicationName,
                },
              drug2: {
                equals: currentMed,
                },
            },
            {
              drug1: {
                equals: currentMed,
                },
              drug2: {
                equals: dto.medicationName,
                },
            },
          ],
        },
      });

      for (const interaction of potentialInteractions) {
        interactions.push({
          drug1: interaction.drug1,
          drug2: interaction.drug2,
          severity: interaction.severity,
          description: interaction.description,
          clinicalEffect: interaction.clinicalEffect || undefined,
          management: interaction.management || undefined,
        });
      }
    }

    return {
      hasInteractions: interactions.length > 0,
      interactions,
    };
  }
}
