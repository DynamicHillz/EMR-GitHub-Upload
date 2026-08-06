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
  status?: string;
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  skip?: number;
  take?: number;
  // Skip the PatientAllergy include — for typeahead/picker call sites that
  // only render id/name/patientId/phone and have no business reason to
  // receive a patient's allergy list just to populate an autocomplete.
  lite?: boolean;
}

export interface PatientCreateData {
  id?: string; // honored if the offline queue (or an online client) pre-assigned the entity id — see patient.repository.ts's create()
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  lga?: string;
  country?: string;
  nationality?: string;
  occupation?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  genotype?: string;
  allergies?: string[];
  patientAllergies?: any[];
  chronicConditions?: string[];
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  patientType?: 'PRIVATE' | 'HMO';
  hmoProvider?: string;
  hmoProviderId?: string;
  hmoNumber?: string;
  nhisNumber?: string;
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
  city?: string;
  state?: string;
  lga?: string;
  country?: string;
  nationality?: string;
  occupation?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  genotype?: string;
  allergies?: string[];
  patientAllergies?: any[];
  chronicConditions?: string[];
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  patientType?: 'PRIVATE' | 'HMO';
  hmoProvider?: string;
  hmoProviderId?: string;
  hmoNumber?: string;
  nhisNumber?: string;
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
   * Exact lookup by phone number — for duplicate checks. Deliberately not
   * the fuzzy `search()` below: a phone that happens to be a substring of
   * another patient's phone/patientId/email would otherwise false-positive
   * as a duplicate (and vice versa).
   */
  findByPhone(phone: string, tenantId: string): Promise<PatientEntity | null>;

  /**
   * Search patients by criteria
   */
  search(criteria: PatientSearchCriteria): Promise<{ patients: PatientEntity[]; total: number }>;

  /**
   * Create a new patient
   */
  create(data: PatientCreateData): Promise<PatientEntity>;

  /**
   * Update a patient. If expectedVersion is supplied, the update is
   * rejected (ConflictError) when the record's current version doesn't
   * match — used by the offline-sync push path to detect concurrent edits.
   */
  update(id: string, tenantId: string, data: PatientUpdateData, expectedVersion?: number): Promise<PatientEntity>;

  /**
   * Delete a patient (soft delete)
   */
  delete(id: string, tenantId: string, userId?: string): Promise<void>;

  /**
   * Check if patient ID is unique for the tenant
   */
  isPatientIdUnique(patientId: string, tenantId: string): Promise<boolean>;
}
