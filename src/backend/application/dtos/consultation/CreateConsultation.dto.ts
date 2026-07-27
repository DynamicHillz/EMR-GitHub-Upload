/**
 * Create Consultation DTO
 *
 * Data Transfer Object for creating a new consultation
 */

export interface CreateConsultationDto {
  patientId: string;
  doctorId: string;

  // SOAP Notes (REQ-CLIN-1)
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;

  // Vital Signs (REQ-CLIN-2)
  bloodPressure?: string; // Format: XXX/YYY
  heartRate?: number; // bpm
  respiratoryRate?: number; // breaths per min
  temperature?: number; // Celsius
  weight?: number; // kg
  height?: number; // cm
  headCircumference?: number; // cm
  muac?: number; // cm
  spO2?: number; // Percentage

  // Diagnoses (ICD-11/10) (REQ-CLIN-5)
  diagnoses?: { diagnosisId: string; isPrimary: boolean; notes?: string }[];
  icd10Codes?: string[];
}

export interface ConsultationResponseDto {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;

  // SOAP Notes
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;

  // Vital Signs with calculated BMI
  vitalSigns: {
    bloodPressure: string | null;
    heartRate: number | null;
    respiratoryRate: number | null;
    temperature: number | null;
    weight: number | null;
    height: number | null;
    headCircumference: number | null;
    muac: number | null;
    spO2: number | null;
    bmi: number | null;
    bmiCategory: string | null;
    zScoreWeightForAge: number | null;
    zScoreHeightForAge: number | null;
    zScoreWeightForHeight: number | null;
    zScoreBMIForAge: number | null;
  };

  icd10Codes?: string[];

  // Diagnoses
  diagnoses: { diagnosisId: string; code: string; name: string; isPrimary: boolean; notes?: string | null }[];

  // Status
  status: string;
  canEdit: boolean;
  canFinalize: boolean;
  finalizedAt: string | null;

  // Metadata
  consultationDate: string;
  createdAt: string;
  updatedAt: string;

  // Optimistic-concurrency token — the client must echo this back on
  // update/finalize so a stale save gets a conflict instead of silently
  // overwriting a newer one.
  version?: number;
}

export interface CreateConsultationResponse {
  success: boolean;
  message: string;
  data?: ConsultationResponseDto;
  error?: string;
}
