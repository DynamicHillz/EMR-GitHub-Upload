/**
 * Get Medications Use Case
 *
 * Retrieve list of all medications for dropdown/selection
 */

import { PrismaClient } from '@prisma/client';

export interface MedicationDto {
  id: string;
  name: string;
  genericName?: string;
  brandName?: string;
  category?: string;
  strength: string;
  dosageForm: string;
  drugClass?: string;
  unitPrice: number;
  reorderPoint?: number;
  stockLevel?: number;
  isControlledSubstance: boolean;
  scheduleClass?: string;
}

export class GetMedicationsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string): Promise<MedicationDto[]> {
    const medications = await this.prisma.medication.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        genericName: true,
        brandName: true,
        category: true,
        strength: true,
        dosageForm: true,
        drugClass: true,
        unitPrice: true,
        reorderPoint: true,
        stockLevel: true,
        isControlledSubstance: true,
        scheduleClass: true,
      },
      orderBy: { name: 'asc' },
    });

    return medications.map((med) => ({
      id: med.id,
      name: med.name,
      genericName: med.genericName || undefined,
      brandName: med.brandName || undefined,
      category: med.category || undefined,
      strength: med.strength,
      dosageForm: med.dosageForm,
      drugClass: med.drugClass || undefined,
      unitPrice: Number(med.unitPrice),
      reorderPoint: med.reorderPoint ?? undefined,
      stockLevel: med.stockLevel ?? undefined,
      isControlledSubstance: med.isControlledSubstance,
      scheduleClass: med.scheduleClass || undefined,
    }));
  }
}
