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
      // @ts-ignore - Temporary fix for schema alignment
      systolicBP: dto.bloodPressure ? parseInt(dto.bloodPressure.split("/")[0]) : undefined,
      diastolicBP: dto.bloodPressure ? parseInt(dto.bloodPressure.split("/")[1]) : undefined,
      heartRate: dto.heartRate,
      respiratoryRate: dto.respiratoryRate,
      temperature: dto.temperature,
      weight: dto.weight,
      height: dto.height,
      headCircumference: dto.headCircumference,
      muac: dto.muac,
      spO2: dto.spO2,
      diagnoses: dto.diagnoses,
      icd10Codes: dto.icd10Codes ? JSON.stringify(dto.icd10Codes) : undefined,
    }, dto.version);

    // 4. Return response DTO
    const updatedEntity = ConsultationEntity.fromDatabase(updated);
    // fromDatabase() doesn't carry `version` through — read it directly off
    // the repository's mapped result so the caller can save it for the next update.
    return this.toResponseDto(updatedEntity, (updated as any).version);
  }

  private toResponseDto(consultation: ConsultationEntity, version?: number): ConsultationResponseDto {
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
        respiratoryRate: consultation.respiratoryRate,
        temperature: consultation.temperature,
        weight: consultation.weight,
        height: consultation.height,
        headCircumference: consultation.headCircumference,
        muac: consultation.muac,
        spO2: consultation.spO2,
        bmi: consultation.bmi,
        bmiCategory: consultation.getBMICategory(),
        zScoreWeightForAge: consultation.zScoreWeightForAge,
        zScoreHeightForAge: consultation.zScoreHeightForAge,
        zScoreWeightForHeight: consultation.zScoreWeightForHeight,
        zScoreBMIForAge: consultation.zScoreBMIForAge,
      },

      diagnoses: consultation.getDiagnoses(),
      icd10Codes: consultation.icd10Codes,

      status: consultation.status,
      canEdit: consultation.canEdit(),
      canFinalize: consultation.canFinalize(),
      finalizedAt: consultation.finalizedAt ? consultation.finalizedAt.toISOString() : null,

      consultationDate: consultation.consultationDate.toISOString(),
      createdAt: consultation.createdAt.toISOString(),
      updatedAt: consultation.updatedAt.toISOString(),
      version,
    };
  }
}
