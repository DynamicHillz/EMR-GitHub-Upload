/**
 * Get Medication Batches Use Case
 *
 * Fetches available medication batches for dispensing
 */

import { PrismaClient } from '@prisma/client';

export interface GetMedicationBatchesDto {
  medicationName: string;
}

export interface MedicationBatchDto {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  medicationName: string;
}

export class GetMedicationBatchesUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    dto: GetMedicationBatchesDto,
    tenantId: string
  ): Promise<MedicationBatchDto[]> {
    // Find medication by name
    const medication = await this.prisma.medication.findFirst({
      where: {
        tenantId,
        name: {
          equals: dto.medicationName,
          },
      },
    });

    if (!medication) {
      // Return empty array if medication not found
      return [];
    }

    // Fetch all ACTIVE batches for this medication
    const batches = await this.prisma.medicationBatch.findMany({
      where: {
        tenantId,
        medicationId: medication.id,
        status: 'ACTIVE',
        quantity: {
          gt: 0, // Only batches with stock
        },
      },
      orderBy: [
        // FEFO - First Expiry, First Out
        { expiryDate: 'asc' },
      ],
    });

    // Transform to DTO
    return batches.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate.toISOString(),
      quantity: batch.quantity,
      medicationName: medication.name,
    }));
  }
}
