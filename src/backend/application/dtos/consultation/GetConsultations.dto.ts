/**
 * Get Consultations DTO
 *
 * Data Transfer Object for querying consultations
 * REQ-CLIN-8: Get patient consultation history
 */

export interface GetConsultationsDto {
  patientId?: string;
  doctorId?: string;
  status?: string;
  skip?: number;
  take?: number;
}

export interface GetConsultationsResponse {
  success: boolean;
  message: string;
  data?: Array<{
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
  }>;
  total?: number;
  error?: string;
}
