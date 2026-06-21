/**
 * Add Medication Use Case
 *
 * Add a new medication to the system
 */

import { PrismaClient } from '@prisma/client';
import { ConflictError } from '../../../shared/errors/AppError';

export interface AddMedicationDto {
  name: string;
  genericName?: string;
  brandName?: string;
  activeIngredient?: string;
  category?: string;
  dosageForm?: string;
  strength?: string;
  drugClass?: string;
  reorderPoint?: number;
  unitPrice: number;
}

export class AddMedicationUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: AddMedicationDto, tenantId: string) {
    // Check if medication already exists
    const existing = await this.prisma.medication.findFirst({
      where: {
        tenantId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictError('Medication with this name already exists');
    }

    const medication = await this.prisma.medication.create({
      data: {
        tenantId,
        name: dto.name,
        genericName: dto.genericName,
        brandName: dto.brandName,
        activeIngredient: dto.activeIngredient,
        category: dto.category as any,
        dosageForm: dto.dosageForm,
        strength: dto.strength,
        drugClass: dto.drugClass,
        stockLevel: 0,
        reorderPoint: dto.reorderPoint || 10,
        unitPrice: dto.unitPrice,
      },
    });

    return medication;
  }
}
