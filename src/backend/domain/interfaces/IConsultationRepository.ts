/**
 * Consultation Repository Interface
 *
 * Defines the contract for consultation data access operations
 */

import { Consultation } from '../entities/Consultation.entity';

export interface ConsultationCreateData {
  tenantId: string;
  patientId: string;
  doctorId: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  spO2?: number;
  icd10Codes?: string[]; // Will be stringified before storage
}

export interface ConsultationUpdateData {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  spO2?: number;
  icd10Codes?: string[]; // Will be stringified before storage
}

export interface GetConsultationsOptions {
  patientId?: string;
  doctorId?: string;
  status?: string;
  limit?: number;
  skip?: number;
}

export interface IConsultationRepository {
  /**
   * Find consultation by ID within tenant
   */
  findById(id: string, tenantId: string): Promise<Consultation | null>;

  /**
   * Find all consultations for a patient (REQ-CLIN-8: Patient history)
   */
  findByPatientId(
    patientId: string,
    tenantId: string,
    options?: { limit?: number; skip?: number }
  ): Promise<Consultation[]>;

  /**
   * Find all consultations for a doctor
   */
  findByDoctorId(
    doctorId: string,
    tenantId: string,
    options?: { limit?: number; skip?: number }
  ): Promise<Consultation[]>;

  /**
   * Find consultations with filters
   */
  find(tenantId: string, options: GetConsultationsOptions): Promise<Consultation[]>;

  /**
   * Create a new consultation
   */
  create(data: ConsultationCreateData): Promise<Consultation>;

  /**
   * Update an existing consultation
   * Returns null if consultation not found
   * Note: Business validation (status checks) should be in use case layer
   */
  update(id: string, tenantId: string, data: ConsultationUpdateData): Promise<Consultation | null>;

  /**
   * Finalize a consultation (REQ-CLIN-6: Lock consultation)
   * Changes status from DRAFT to FINALIZED
   * Returns null if consultation not found
   * Note: Business validation should be in use case layer
   */
  finalize(id: string, tenantId: string): Promise<Consultation | null>;

  /**
   * Lock a consultation (prevents any further changes)
   * Changes status from FINALIZED to LOCKED
   * Returns null if consultation not found
   */
  lock(id: string, tenantId: string): Promise<Consultation | null>;

  /**
   * Delete a consultation (soft delete if applicable)
   */
  delete(id: string, tenantId: string): Promise<void>;
}
