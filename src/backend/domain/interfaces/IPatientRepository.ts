/**
 * Patient Repository Interface
 *
 * This defines the contract for patient data access operations.
 * The domain layer defines the interface, but the infrastructure layer implements it.
 * This follows the Dependency Inversion Principle (SOLID).
 */

import { PatientEntity } from '../entities/Patient.entity';

export interface PatientSearchCriteria {
  tenantId: string;
  query?: string;
  skip?: number;
  take?: number;
}

export interface PatientCreateData {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  consentGiven?: boolean; // US-PAT-006: Consent tracking
  tenantId: string;
}

export interface PatientUpdateData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  phone?: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
}

export interface IPatientRepository {
  /**
   * Find a patient by ID
   */
  findById(id: string, tenantId: string): Promise<PatientEntity | null>;

  /**
   * Find a patient by patient ID
   */
  findByPatientId(patientId: string, tenantId: string): Promise<PatientEntity | null>;

  /**
   * Search patients by criteria
   */
  search(criteria: PatientSearchCriteria): Promise<{ patients: PatientEntity[]; total: number }>;

  /**
   * Create a new patient
   */
  create(data: PatientCreateData): Promise<PatientEntity>;

  /**
   * Update a patient
   */
  update(id: string, tenantId: string, data: PatientUpdateData): Promise<PatientEntity>;

  /**
   * Delete a patient (soft delete)
   */
  delete(id: string, tenantId: string): Promise<void>;

  /**
   * Check if patient ID is unique for the tenant
   */
  isPatientIdUnique(patientId: string, tenantId: string): Promise<boolean>;
}
