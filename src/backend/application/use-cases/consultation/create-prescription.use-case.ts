/**
 * Create Prescription Use Case
 *
 * Business logic for creating prescriptions from consultations
 * REQ-CLIN-3: E-prescribing
 * REQ-CLIN-7: Allergy checking
 */

import { PrismaClient } from '@prisma/client';
import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { NotFoundError } from '../../../shared/errors/AppError';

export interface CreatePrescriptionDto {
  consultationId: string;
  patientId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  quantity?: number;
}

export interface PrescriptionResponseDto {
  id: string;
  consultationId: string | null;
  patientId: string;
  patientName: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  quantity: number | null;
  status: string;
  allergyWarning: boolean;
  allergyDetails?: string[];
  interactionWarning: boolean;
  createdAt: string;
}

export class CreatePrescriptionUseCase {
  constructor(
    private prisma: PrismaClient,
    private patientRepository: IPatientRepository
  ) {}

  async execute(
    dto: CreatePrescriptionDto,
    doctorId: string,
    tenantId: string
  ): Promise<PrescriptionResponseDto> {
    // 1. Get patient to check allergies (REQ-CLIN-7)
    const patient = await this.patientRepository.findById(dto.patientId, tenantId);

    if (!patient) {
      throw new NotFoundError('Patient', dto.patientId);
    }

    // 2. Check for allergies (REQ-CLIN-7)
    const patientAllergies = patient.allergies || [];
    const allergyWarning = this.checkForAllergies(
      dto.medicationName,
      patientAllergies
    );

    const allergyDetails = allergyWarning
      ? this.findMatchingAllergies(dto.medicationName, patientAllergies)
      : [];

    // 3. Create prescription
    const prescription = await this.prisma.prescription.create({
      data: {
        tenantId,
        patientId: dto.patientId,
        consultationId: dto.consultationId || null,
        doctorId,
        medicationName: dto.medicationName,
        dosage: dto.dosage,
        frequency: dto.frequency,
        duration: dto.duration,
        instructions: dto.instructions,
        quantity: dto.quantity,
        allergyWarning,
        interactionWarning: false, // TODO: Implement drug interaction checking
        status: 'PENDING',
      },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // 4. Return response with allergy warning
    return {
      id: prescription.id,
      consultationId: prescription.consultationId,
      patientId: prescription.patientId,
      patientName: `${prescription.patient.firstName} ${prescription.patient.lastName}`,
      medicationName: prescription.medicationName,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      duration: prescription.duration,
      instructions: prescription.instructions,
      quantity: prescription.quantity,
      status: prescription.status,
      allergyWarning: prescription.allergyWarning,
      allergyDetails,
      interactionWarning: prescription.interactionWarning,
      createdAt: prescription.createdAt.toISOString(),
    };
  }

  /**
   * Check if medication name matches any patient allergies
   * REQ-CLIN-7: Display warnings for medication allergies
   */
  private checkForAllergies(medicationName: string, allergies: string[]): boolean {
    if (!allergies || allergies.length === 0) {
      return false;
    }

    const medLower = medicationName.toLowerCase();

    return allergies.some((allergy) => {
      const allergyLower = allergy.toLowerCase();

      // Check if medication name contains the allergy or vice versa
      return (
        medLower.includes(allergyLower) || allergyLower.includes(medLower)
      );
    });
  }

  /**
   * Find which specific allergies match the medication
   */
  private findMatchingAllergies(
    medicationName: string,
    allergies: string[]
  ): string[] {
    const medLower = medicationName.toLowerCase();

    return allergies.filter((allergy) => {
      const allergyLower = allergy.toLowerCase();
      return (
        medLower.includes(allergyLower) || allergyLower.includes(medLower)
      );
    });
  }
}
