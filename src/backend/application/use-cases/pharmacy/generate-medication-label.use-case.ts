/**
 * Generate Medication Label Use Case
 *
 * REQ-PHARM-8: Generate medication labels for dispensed medications
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../shared/errors/AppError';

export interface GenerateLabelDto {
  dispensingRecordId: string;
}

export interface MedicationLabelData {
  id: string;
  patientName: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  quantity: number;
  batchNumber: string;
  expiryDate: string;
  dispensedDate: string;
  pharmacistName: string;
  instructions: string;
  labelUrl: string;
}

export class GenerateMedicationLabelUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    dto: GenerateLabelDto,
    tenantId: string
  ): Promise<MedicationLabelData> {
    // Get dispensing record with all related data
    const dispensingRecord = await this.prisma.dispensingRecord.findFirst({
      where: {
        id: dto.dispensingRecordId,
        tenantId,
      },
      include: {
        prescription: {
          include: {
            patient: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        batch: true,
        pharmacist: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!dispensingRecord) {
      throw new NotFoundError('DispensingRecord', dto.dispensingRecordId);
    }

    const prescription = dispensingRecord.prescription;
    const patient = prescription.patient;
    const pharmacist = dispensingRecord.pharmacist;

    // Generate label data
    const labelData: MedicationLabelData = {
      id: dispensingRecord.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      medicationName: prescription.medicationName,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      quantity: dispensingRecord.quantityDispensed,
      batchNumber: dispensingRecord.batch.batchNumber,
      expiryDate: dispensingRecord.batch.expiryDate.toISOString(),
      dispensedDate: dispensingRecord.dispensedAt.toISOString(),
      pharmacistName: `${pharmacist.firstName} ${pharmacist.lastName}`,
      instructions: `Take ${prescription.dosage} ${prescription.frequency}`,
      labelUrl: `/api/pharmacy/labels/${dispensingRecord.id}/print`,
    };

    // Update dispensing record to mark label as generated
    await this.prisma.dispensingRecord.update({
      where: { id: dto.dispensingRecordId },
      data: {
        labelGenerated: true,
        labelUrl: labelData.labelUrl,
      },
    });

    return labelData;
  }
}
