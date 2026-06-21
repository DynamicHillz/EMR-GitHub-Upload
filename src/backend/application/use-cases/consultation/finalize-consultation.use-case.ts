/**
 * Finalize Consultation Use Case
 *
 * Business logic for finalizing a consultation
 * REQ-CLIN-6: Lock finalized consultations to prevent editing
 */

import { IConsultationRepository } from '../../../domain/interfaces/IConsultationRepository';
import { ConsultationEntity } from '../../../domain/entities/Consultation.entity';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export class FinalizeConsultationUseCase {
  constructor(private consultationRepository: IConsultationRepository) {}

  async execute(id: string, tenantId: string): Promise<{ success: boolean; message: string }> {
    // 1. Get consultation
    const consultation = await this.consultationRepository.findById(id, tenantId);

    if (!consultation) {
      throw new NotFoundError('Consultation', id);
    }

    // 2. Validate can be finalized
    const entity = ConsultationEntity.fromDatabase(consultation);

    if (!entity.canFinalize()) {
      if (!entity.isDraft()) {
        throw new ValidationError('Consultation is already finalized');
      }

      throw new ValidationError('Subjective and Assessment are required to finalize consultation');
    }

    // 3. Finalize consultation
    await this.consultationRepository.finalize(id, tenantId);

    return {
      success: true,
      message: 'Consultation finalized successfully. It can no longer be edited.',
    };
  }
}
