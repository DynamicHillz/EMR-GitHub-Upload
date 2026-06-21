/**
 * Create Consultation Use Case
 *
 * Business logic for creating a new consultation
 * REQ-CLIN-1: SOAP format documentation
 * REQ-CLIN-2: Vital signs with BMI calculation
 */

import { IConsultationRepository } from '../../../domain/interfaces/IConsultationRepository';
import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { CreateConsultationDto, ConsultationResponseDto } from '../../dtos/consultation/CreateConsultation.dto';
import { ConsultationEntity } from '../../../domain/entities/Consultation.entity';
import { NotFoundError } from '../../../shared/errors/AppError';

export class CreateConsultationUseCase {
  constructor(
    private consultationRepository: IConsultationRepository,
    private patientRepository: IPatientRepository
  ) {}

  async execute(dto: CreateConsultationDto, tenantId: string): Promise<ConsultationResponseDto> {
    // 1. Verify patient exists and belongs to tenant
    const patient = await this.patientRepository.findById(dto.patientId, tenantId);

    if (!patient) {
      throw new NotFoundError('Patient', dto.patientId);
    }

    // 2. Create consultation (BMI will be auto-calculated in repository)
    const consultation = await this.consultationRepository.create({
      tenantId,
      patientId: dto.patientId,
      doctorId: dto.doctorId,
      subjective: dto.subjective,
      objective: dto.objective,
      assessment: dto.assessment,
      plan: dto.plan,
      bloodPressure: dto.bloodPressure,
      heartRate: dto.heartRate,
      temperature: dto.temperature,
      weight: dto.weight,
      height: dto.height,
      spO2: dto.spO2,
      icd10Codes: dto.icd10Codes,
    });

    // 3. Convert to entity for business logic
    const entity = ConsultationEntity.fromDatabase(consultation);

    // 4. Return response DTO
    return this.toResponseDto(entity, patient);
  }

  private toResponseDto(consultation: ConsultationEntity, patient: any): ConsultationResponseDto {
    return {
      id: consultation.id,
      patientId: consultation.patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      doctorId: consultation.doctorId,
      doctorName: 'Doctor Name', // TODO: Get from user context or query

      // SOAP
      subjective: consultation.subjective,
      objective: consultation.objective,
      assessment: consultation.assessment,
      plan: consultation.plan,

      // Vital Signs
      vitalSigns: {
        bloodPressure: consultation.bloodPressure,
        heartRate: consultation.heartRate,
        temperature: consultation.temperature,
        weight: consultation.weight,
        height: consultation.height,
        spO2: consultation.spO2,
        bmi: consultation.bmi,
        bmiCategory: consultation.getBMICategory(),
      },

      // ICD-10
      icd10Codes: consultation.getICD10Codes(),

      // Status
      status: consultation.status,
      canEdit: consultation.canEdit(),
      canFinalize: consultation.canFinalize(),
      finalizedAt: consultation.finalizedAt ? consultation.finalizedAt.toISOString() : null,

      // Metadata
      consultationDate: consultation.consultationDate.toISOString(),
      createdAt: consultation.createdAt.toISOString(),
      updatedAt: consultation.updatedAt.toISOString(),
    };
  }
}
