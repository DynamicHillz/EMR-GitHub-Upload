/**
 * Create Prescription Use Case
 *
 * Business logic for creating prescriptions from consultations
 * REQ-CLIN-3: E-prescribing
 * REQ-CLIN-7: Allergy checking
 */

import { PrismaClient } from '@prisma/client';
import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { checkDrugInteractions, checkDuplicateTherapy } from '../../services/drug-interaction-checker.service';
import { checkForAllergies, findMatchingAllergies } from '../../services/allergy-checker.service';

export interface CreatePrescriptionDto {
  consultationId?: string;
  admissionId?: string;
  ancVisitId?: string;
  type?: 'OUTPATIENT' | 'INPATIENT' | 'ANC';
  patientId: string;
  medicationId?: string;
  medicationName: string;
  route: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  quantity?: number;
  isControlledSubstance?: boolean;
  dispenseRationale?: string;
}

export interface PrescriptionResponseDto {
  id: string;
  consultationId: string | null;
  admissionId: string | null;
  ancVisitId: string | null;
  patientId: string;
  patientName: string;
  medicationId: string | null;
  medicationName: string;
  route: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  quantity: number | null;
  status: string;
  allergyWarning: boolean;
  allergyDetails?: string[];
  interactionWarning: boolean;
  interactionDetails?: string[];
  duplicateWarning: boolean;
  duplicateDetails?: string[];
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

    // 1.2 Verify the consultation (when linked) actually belongs to this
    // tenant and this patient — the FK alone only proves the row exists
    // somewhere, not that it's the right one.
    if (dto.consultationId) {
      const consultation = await this.prisma.consultation.findFirst({
        where: { id: dto.consultationId, tenantId, isDeleted: false },
        select: { id: true, patientId: true },
      });
      if (!consultation) {
        throw new NotFoundError('Consultation', dto.consultationId);
      }
      if (consultation.patientId !== dto.patientId) {
        throw new ValidationError('Consultation does not belong to the specified patient');
      }
    }

    // 1.5 Check controlled substance duration limits (REQ-CLIN-CS)
    if (dto.isControlledSubstance) {
      const durationNum = parseInt(dto.duration.split(' ')[0]) || 0;
      if (durationNum > 7 && !dto.dispenseRationale) {
        throw new Error('Validation error: Controlled substances prescribed for >7 days require a dispense rationale/justification.');
      }
    }

    // 2. Check for allergies (REQ-CLIN-7)
    const patientAllergies = patient.allergies || [];
    const allergyWarning = checkForAllergies(
      dto.medicationName,
      patientAllergies
    );

    const allergyDetails = allergyWarning
      ? findMatchingAllergies(dto.medicationName, patientAllergies)
      : [];

    // 2.5 Check for drug interactions and duplicate/overlapping therapy
    const { interactionWarning, interactionDetails: interactionDetailsList } =
      await checkDrugInteractions(this.prisma, tenantId, dto.patientId, dto.medicationName);
    const { duplicateWarning, duplicateDetails } =
      await checkDuplicateTherapy(this.prisma, tenantId, dto.patientId, dto.medicationName);

    // 3. Determine prescription type based on which context FK is present
    const type = dto.type || (dto.admissionId ? 'INPATIENT' : dto.ancVisitId ? 'ANC' : 'OUTPATIENT');

    // 4. Create prescription
    const prescription = await this.prisma.prescription.create({
      data: {
        tenantId,
        patientId: dto.patientId,
        consultationId: dto.consultationId || null,
        admissionId: dto.admissionId || null,
        ancVisitId: dto.ancVisitId || null,
        type,
        doctorId,
        medicationId: dto.medicationId || null,
        medicationName: dto.medicationName,
        route: dto.route as any, // Cast to any to avoid importing AdministrationRoute if it's not exported correctly, Prisma handles it
        dosage: dto.dosage,
        frequency: dto.frequency,
        duration: dto.duration,
        instructions: dto.instructions,
        quantity: dto.quantity,
        allergyWarning,
        interactionWarning,
        isControlledSubstance: dto.isControlledSubstance || false,
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

    // 5. Return response with allergy warning
    return {
      id: prescription.id,
      consultationId: prescription.consultationId,
      admissionId: prescription.admissionId,
      ancVisitId: prescription.ancVisitId,
      patientId: prescription.patientId,
      patientName: `${prescription.patient.firstName} ${prescription.patient.lastName}`,
      medicationId: prescription.medicationId,
      medicationName: prescription.medicationName,
      route: prescription.route,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      duration: prescription.duration,
      instructions: prescription.instructions,
      quantity: prescription.quantity,
      status: prescription.status,
      allergyWarning: prescription.allergyWarning,
      allergyDetails,
      interactionWarning: prescription.interactionWarning,
      interactionDetails: interactionDetailsList,
      duplicateWarning,
      duplicateDetails,
      createdAt: prescription.createdAt.toISOString(),
    };
  }
}
