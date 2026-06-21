/**
 * Get Patient Consultations Use Case
 *
 * Business logic for retrieving patient consultation history
 * REQ-CLIN-8: Auto-populate patient medical history
 */

import { IConsultationRepository } from '../../../domain/interfaces/IConsultationRepository';
import { ConsultationEntity } from '../../../domain/entities/Consultation.entity';

interface PatientConsultationSummary {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  subjective: string | null;
  assessment: string | null;
  status: string;
  consultationDate: string;
  finalizedAt: string | null;
  createdAt: string;
}

export class GetPatientConsultationsUseCase {
  constructor(private consultationRepository: IConsultationRepository) {}

  async execute(
    patientId: string,
    tenantId: string,
    options?: { limit?: number }
  ): Promise<PatientConsultationSummary[]> {
    const consultations = await this.consultationRepository.findByPatientId(
      patientId,
      tenantId,
      options
    );

    return consultations.map(c => {
      const entity = ConsultationEntity.fromDatabase(c);
      return {
        id: entity.id,
        patientId: entity.patientId,
        patientName: '', // Will be populated by controller
        doctorId: entity.doctorId,
        doctorName: '', // Will be populated by controller
        subjective: entity.subjective,
        assessment: entity.assessment,
        status: entity.status,
        consultationDate: entity.consultationDate.toISOString(),
        finalizedAt: entity.finalizedAt ? entity.finalizedAt.toISOString() : null,
        createdAt: entity.createdAt.toISOString(),
      };
    });
  }
}
