import type { Gender } from '../../../shared/types/prisma-enums.ts';;
import { EmergencyContact } from '../../../domain/entities/Patient.entity';

export interface RegisterPatientDto {
  id?: string; // honored if pre-assigned client-side (offline registration) — see register-patient.use-case.ts
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date string
  gender: Gender;
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
  pastSurgicalHistory?: string;
  emergencyContact?: EmergencyContact;
  nhisNumber?: string;
  patientType?: 'PRIVATE' | 'HMO';
  hmoProvider?: string; // legacy free-text — kept for backward-compat display/fallback only
  hmoProviderId?: string; // real FK, drives billing coverage — see generate-invoice.use-case.ts
  hmoNumber?: string;
  photoUrl?: string;
  consentGiven?: boolean; // US-PAT-006: Data processing consent
}

export interface PatientResponseDto {
  id: string;
  version: number; // for optimistic-concurrency round-tripping (offline sync)
  patientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  age: number;
  gender: Gender;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  lga: string | null;
  country: string;
  nationality: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  bloodGroup: string | null;
  genotype: string | null;
  allergies: string[];
  chronicConditions: string[];
  pastSurgicalHistory: string | null;
  emergencyContact: EmergencyContact | null;
  nhisNumber: string | null;
  patientType: 'PRIVATE' | 'HMO';
  hmoProvider: string | null;
  hmoProviderId: string | null;
  hmoNumber: string | null;
  photoUrl: string | null;
  status: string;
  hasAllergies: boolean;
  consentGiven: boolean; // US-PAT-006: Data processing consent
  consentDate: string | null;
  consentVersion: string | null;
  createdAt: string;
  updatedAt: string;
  // Newborn linkage (see record-delivery-outcome.use-case.ts) — lets the
  // frontend cross-link a mother's and newborn's own charts.
  motherPatientId: string | null;
  mother: { id: string; patientId: string; firstName: string; lastName: string } | null;
  newbornChildren: Array<{ id: string; patientId: string; firstName: string; lastName: string }>;
}

export interface UpdatePatientDto {
  version?: number; // expected version, for optimistic-concurrency conflict detection
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender;
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
  chronicConditions?: string[];
  pastSurgicalHistory?: string;
  emergencyContact?: EmergencyContact;
  nhisNumber?: string;
  patientType?: 'PRIVATE' | 'HMO';
  hmoProvider?: string;
  hmoProviderId?: string;
  hmoNumber?: string;
  photoUrl?: string;
  status?: string;
}

export interface SearchPatientDto {
  query?: string;
  status?: string;
  gender?: Gender;
  ageMin?: number;
  ageMax?: number;
  page?: number;
  limit?: number;
  lite?: boolean;
}
