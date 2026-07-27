/**
 * Get Consultation Use Case
 *
 * Business logic for retrieving a single consultation
 */

import { IConsultationRepository } from '../../../domain/interfaces/IConsultationRepository';
import { ConsultationResponseDto } from '../../dtos/consultation/CreateConsultation.dto';
import { ConsultationEntity } from '../../../domain/entities/Consultation.entity';
import { NotFoundError } from '../../../shared/errors/AppError';

export class GetConsultationUseCase {
  constructor(private consultationRepository: IConsultationRepository) {}

  async execute(id: string, tenantId: string): Promise<ConsultationResponseDto> {
    const consultation = await this.consultationRepository.findById(id, tenantId);

    if (!consultation) {
      throw new NotFoundError('Consultation', id);
    }

    const entity = ConsultationEntity.fromDatabase(consultation);

    return {
      id: entity.id,
      patientId: entity.patientId,
      patientName: '', // Will be populated by controller
      doctorId: entity.doctorId,
      doctorName: '',

      subjective: entity.subjective,
      objective: entity.objective,
      assessment: entity.assessment,
      plan: entity.plan,

      vitalSigns: {
        bloodPressure: entity.bloodPressure,
        heartRate: entity.heartRate,
        respiratoryRate: entity.respiratoryRate,
        temperature: entity.temperature,
        weight: entity.weight,
        height: entity.height,
        headCircumference: entity.headCircumference,
        muac: entity.muac,
        spO2: entity.spO2,
        bmi: entity.bmi,
        bmiCategory: entity.getBMICategory(),
        zScoreWeightForAge: entity.zScoreWeightForAge,
        zScoreHeightForAge: entity.zScoreHeightForAge,
        zScoreWeightForHeight: entity.zScoreWeightForHeight,
        zScoreBMIForAge: entity.zScoreBMIForAge,
      },

      diagnoses: entity.getDiagnoses(),

      status: entity.status,
      canEdit: entity.canEdit(),
      canFinalize: entity.canFinalize(),
      finalizedAt: entity.finalizedAt ? entity.finalizedAt.toISOString() : null,

      consultationDate: entity.consultationDate.toISOString(),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      // fromDatabase()/ConsultationEntity don't carry this field through —
      // read it directly off the repository's mapped result instead.
      version: (consultation as any).version,
    };
  }
}
