/**
 * Add Medication Use Case
 *
 * Add a new medication to the system
 */

import { PrismaClient } from '@prisma/client';
import { ConflictError, ValidationError } from '../../../shared/errors/AppError';

export interface AddMedicationDto {
  name: string;
  genericName?: string;
  brandName?: string;
  activeIngredient?: string;
  category?: string;
  dosageForm: string;
  strength: string;
  drugClass?: string;
  reorderPoint?: number;
  unitPrice: number;
  stockLevel?: number;
  whoAtcCode?: string;
  isEssentialMedicine?: boolean;
}

export class AddMedicationUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: AddMedicationDto, tenantId: string) {
    // Dosage form and strength are required so the prescribing form can rely on
    // them for auto-fill (route, dosage) — pharmacy must supply both when adding
    // a medication to inventory.
    if (!dto.dosageForm || !dto.dosageForm.trim()) {
      throw new ValidationError('Dosage Form is required');
    }
    if (!dto.strength || !dto.strength.trim()) {
      throw new ValidationError('Strength is required');
    }
    if (dto.unitPrice < 0 || (dto.stockLevel !== undefined && dto.stockLevel < 0) || (dto.reorderPoint !== undefined && dto.reorderPoint < 0)) {
      throw new ValidationError('Unit price, stock level, and reorder point must not be negative');
    }

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
        genericName: dto.genericName || undefined,
        brandName: dto.brandName || undefined,
        activeIngredient: dto.activeIngredient || undefined,
        category: dto.category || undefined,
        dosageForm: dto.dosageForm,
        strength: dto.strength,
        drugClass: dto.drugClass || undefined,
        stockLevel: dto.stockLevel ?? 0,
        reorderPoint: dto.reorderPoint || 10,
        unitPrice: dto.unitPrice,
      },
    });

    return medication;
  }
}
