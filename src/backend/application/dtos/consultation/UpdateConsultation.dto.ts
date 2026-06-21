/**
 * Update Consultation DTO
 *
 * Data Transfer Object for updating an existing consultation
 * Only DRAFT consultations can be updated (REQ-CLIN-6)
 */

export interface UpdateConsultationDto {
  // SOAP Notes
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;

  // Vital Signs
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  spO2?: number;

  // ICD-10 Codes
  icd10Codes?: string[];
}

export interface UpdateConsultationResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    status: string;
    updatedAt: Date;
  };
  error?: string;
}
