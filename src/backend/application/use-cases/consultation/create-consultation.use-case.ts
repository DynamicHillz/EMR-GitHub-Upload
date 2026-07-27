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
import { prisma } from '../../../infrastructure/database/prisma.client';

export class CreateConsultationUseCase {
  constructor(
    private consultationRepository: IConsultationRepository,
    private patientRepository: IPatientRepository
  ) {}

  async execute(dto: CreateConsultationDto, tenantId: string, userContext?: any): Promise<ConsultationResponseDto> {
    // 1. Verify patient exists and belongs to tenant
    const patient = await this.patientRepository.findById(dto.patientId, tenantId);

    if (!patient) {
      throw new NotFoundError('Patient', dto.patientId);
    }

    // 2. Try to get latest triage vitals if none provided
    let latestTriage = null;
    if (!dto.bloodPressure && !dto.temperature && !dto.weight) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      latestTriage = await prisma.triage.findFirst({
        where: { tenantId, patientId: dto.patientId, triageTime: { gte: startOfDay } },
        orderBy: { triageTime: 'desc' }
      });
    }

    const systolicBP = dto.bloodPressure ? parseInt(dto.bloodPressure.split("/")[0]) : (latestTriage?.systolicBP ?? null);
    const diastolicBP = dto.bloodPressure ? parseInt(dto.bloodPressure.split("/")[1]) : (latestTriage?.diastolicBP ?? null);
    const subjective = dto.subjective;

    // 3. Create consultation (BMI will be auto-calculated in repository)
    const consultation = await this.consultationRepository.create({
      tenantId,
      patientId: dto.patientId,
      doctorId: dto.doctorId,
      subjective: subjective,
      objective: dto.objective,
      assessment: dto.assessment,
      plan: dto.plan,
      // @ts-ignore - Temporary fix for schema alignment
      systolicBP: systolicBP !== null ? systolicBP : undefined,
      diastolicBP: diastolicBP !== null ? diastolicBP : undefined,
      heartRate: dto.heartRate ?? latestTriage?.heartRate ?? undefined,
      respiratoryRate: dto.respiratoryRate ?? latestTriage?.respiratoryRate ?? undefined,
      temperature: dto.temperature ?? latestTriage?.temperature ?? undefined,
      weight: dto.weight ?? latestTriage?.weight ?? undefined,
      height: dto.height ?? undefined,
      headCircumference: dto.headCircumference,
      muac: dto.muac ?? latestTriage?.muac ?? undefined,
      spO2: dto.spO2 ?? latestTriage?.spO2 ?? undefined,
      diagnoses: dto.diagnoses,
      icd10Codes: dto.icd10Codes ? JSON.stringify(dto.icd10Codes) : undefined,
    });

    // 3. Convert to entity for business logic
    const entity = ConsultationEntity.fromDatabase(consultation);

    // 4. Return response DTO
    return this.toResponseDto(entity, patient, userContext);
  }

  private toResponseDto(consultation: ConsultationEntity, patient: any, userContext?: any): ConsultationResponseDto {
    return {
      id: consultation.id,
      patientId: consultation.patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      doctorId: consultation.doctorId,
      doctorName: userContext ? `${userContext.firstName || ''} ${userContext.lastName || ''}`.trim() : 'Unknown Doctor',

      // SOAP
      subjective: consultation.subjective,
      objective: consultation.objective,
      assessment: consultation.assessment,
      plan: consultation.plan,

      // Vital Signs
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

      // Diagnoses
      diagnoses: consultation.getDiagnoses(),
      icd10Codes: consultation.icd10Codes,

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
