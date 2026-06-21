/**
 * Update Consultation Use Case
 *
 * Business logic for updating an existing consultation
 * REQ-CLIN-6: Only allow updates to DRAFT consultations
 */

import { IConsultationRepository } from '../../../domain/interfaces/IConsultationRepository';
import { UpdateConsultationDto } from '../../dtos/consultation/UpdateConsultation.dto';
import { ConsultationResponseDto } from '../../dtos/consultation/CreateConsultation.dto';
import { ConsultationEntity } from '../../../domain/entities/Consultation.entity';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export class UpdateConsultationUseCase {
  constructor(private consultationRepository: IConsultationRepository) {}

  async execute(
    id: string,
    dto: UpdateConsultationDto,
    tenantId: string
  ): Promise<ConsultationResponseDto> {
    // 1. Get existing consultation (this validates it exists and belongs to tenant)
    const existing = await this.consultationRepository.findById(id, tenantId);

    if (!existing) {
      throw new NotFoundError('Consultation', id);
    }

    // 2. Check if consultation can be edited (REQ-CLIN-6)
    const entity = ConsultationEntity.fromDatabase(existing);
    if (!entity.canEdit()) {
      throw new ValidationError('Cannot edit finalized or locked consultation');
    }

    // 3. Update consultation (BMI will be recalculated in repository)
    const updated = await this.consultationRepository.update(id, tenantId, {
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

    // 4. Return response DTO
    const updatedEntity = ConsultationEntity.fromDatabase(updated);
    return this.toResponseDto(updatedEntity);
  }

  private toResponseDto(consultation: ConsultationEntity): ConsultationResponseDto {
    return {
      id: consultation.id,
      patientId: consultation.patientId,
      patientName: '', // Will be populated by controller
      doctorId: consultation.doctorId,
      doctorName: '',

      subjective: consultation.subjective,
      objective: consultation.objective,
      assessment: consultation.assessment,
      plan: consultation.plan,

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

      icd10Codes: consultation.getICD10Codes(),

      status: consultation.status,
      canEdit: consultation.canEdit(),
      canFinalize: consultation.canFinalize(),
      finalizedAt: consultation.finalizedAt ? consultation.finalizedAt.toISOString() : null,

      consultationDate: consultation.consultationDate.toISOString(),
      createdAt: consultation.createdAt.toISOString(),
      updatedAt: consultation.updatedAt.toISOString(),
    };
  }
}
