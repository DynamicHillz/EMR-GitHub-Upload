/**
 * Update Consultation DTO
 *
 * Data Transfer Object for updating an existing consultation
 * Only DRAFT consultations can be updated (REQ-CLIN-6)
 */

export interface UpdateConsultationDto {
  version?: number; // expected version, for optimistic-concurrency conflict detection

  // SOAP Notes
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;

  // Vital Signs
  bloodPressure?: string;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  headCircumference?: number;
  muac?: number;
  spO2?: number;

  // Diagnoses
  diagnoses?: { diagnosisId: string; isPrimary: boolean; notes?: string }[];
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
