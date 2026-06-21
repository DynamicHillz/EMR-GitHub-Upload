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
  strength?: string;
  dosageForm?: string;
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
        strength: true,
        dosageForm: true,
      },
      orderBy: { name: 'asc' },
    });

    return medications.map((med) => ({
      id: med.id,
      name: med.name,
      genericName: med.genericName || undefined,
      strength: med.strength || undefined,
      dosageForm: med.dosageForm || undefined,
    }));
  }
}
