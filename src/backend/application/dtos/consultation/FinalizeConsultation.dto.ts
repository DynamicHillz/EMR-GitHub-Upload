/**
 * Finalize Consultation DTO
 *
 * Data Transfer Object for finalizing a consultation
 * REQ-CLIN-6: Lock finalized consultations to prevent editing
 */

export interface FinalizeConsultationDto {
  id: string;
}

export interface FinalizeConsultationResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    status: string;
    finalizedAt: Date;
  };
  error?: string;
}
