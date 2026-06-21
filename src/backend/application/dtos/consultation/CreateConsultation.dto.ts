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
  temperature?: number; // Celsius
  weight?: number; // kg
  height?: number; // cm
  spO2?: number; // Percentage

  // ICD-10 Codes (REQ-CLIN-5)
  icd10Codes?: string[]; // Array of ICD-10 codes
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
    temperature: number | null;
    weight: number | null;
    height: number | null;
    spO2: number | null;
    bmi: number | null;
    bmiCategory: string | null;
  };

  // ICD-10 Codes
  icd10Codes: string[];

  // Status
  status: string;
  canEdit: boolean;
  canFinalize: boolean;
  finalizedAt: string | null;

  // Metadata
  consultationDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConsultationResponse {
  success: boolean;
  message: string;
  data?: ConsultationResponseDto;
  error?: string;
}
