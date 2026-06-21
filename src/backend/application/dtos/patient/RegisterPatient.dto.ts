import type { Gender } from '../../../shared/types/prisma-enums.ts';;
import { EmergencyContact } from '../../../domain/entities/Patient.entity';

export interface RegisterPatientDto {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date string
  gender: Gender;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
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
  photoUrl?: string;
  consentGiven?: boolean; // US-PAT-006: Data processing consent
}

export interface PatientResponseDto {
  id: string;
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
  photoUrl: string | null;
  status: string;
  hasAllergies: boolean;
  consentGiven: boolean; // US-PAT-006: Data processing consent
  consentDate: string | null;
  consentVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePatientDto {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
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
}
