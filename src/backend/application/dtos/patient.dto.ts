/**
 * Patient Data Transfer Objects (DTOs)
 *
 * DTOs are used to transfer data between layers.
 * They define the shape of data coming in (request) and going out (response).
 */

/**
 * DTO for creating a new patient
 */
export interface CreatePatientDto {
  patientId?: string; // Optional - can be auto-generated
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date string
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
  chronicConditions?: string[];
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    address?: string;
  };
  nhisNumber?: string;
  photoUrl?: string;
  consentGiven?: boolean;
}

/**
 * DTO for updating a patient
 */
export interface UpdatePatientDto {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string; // ISO date string
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

/**
 * DTO for patient response
 */
export interface PatientResponseDto {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string; // ISO date string
  age: number;
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
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * DTO for patient search criteria
 */
export interface PatientSearchDto {
  query?: string; // Search by name, patient number, or phone
  status?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  ageMin?: number;
  ageMax?: number;
  skip?: number;
  take?: number;
}

/**
 * DTO for patient list response
 */
export interface PatientListResponseDto {
  patients: PatientResponseDto[];
  total: number;
  skip: number;
  take: number;
}
