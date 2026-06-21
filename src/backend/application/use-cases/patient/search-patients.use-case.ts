/**
 * Search Patients Use Case
 *
 * US-PAT-003: Patient Search
 *
 * Features:
 * - Real-time search (debounced at 300ms on frontend)
 * - Search by patient ID (exact or partial match)
 * - Search by name (partial, case-insensitive)
 * - Search by phone (partial)
 * - Tenant-scoped results only
 * - Pagination support
 */

import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { SearchPatientDto, PatientResponseDto } from '../../dtos/patient/RegisterPatient.dto';
import { PatientEntity } from '../../../domain/entities/Patient.entity';

export interface SearchPatientsResponse {
  patients: PatientResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class SearchPatientsUseCase {
  constructor(private patientRepository: IPatientRepository) {}

  /**
   * Execute patient search
   * @param dto - Search criteria from API request
   * @param tenantId - Tenant ID from authenticated user
   * @returns Paginated search results
   */
  async execute(dto: SearchPatientDto, tenantId: string): Promise<SearchPatientsResponse> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    // Search patients using repository
    const { patients, total } = await this.patientRepository.search({
      tenantId,
      query: dto.query?.trim(),
      skip,
      take: limit,
    });

    // Convert to response DTOs
    const patientDtos = patients.map(patient => {
      const patientEntity = PatientEntity.fromDatabase(patient);
      return this.toResponseDto(patientEntity);
    });

    // Apply additional filters if needed
    let filteredPatients = patientDtos;

    // Filter by status if provided
    if (dto.status && dto.status !== 'ALL') {
      filteredPatients = filteredPatients.filter(p => p.status === dto.status);
    }

    // Filter by gender if provided
    if (dto.gender) {
      filteredPatients = filteredPatients.filter(p => p.gender === dto.gender);
    }

    // Filter by age range if provided
    if (dto.ageMin !== undefined || dto.ageMax !== undefined) {
      filteredPatients = filteredPatients.filter(p => {
        if (dto.ageMin !== undefined && p.age < dto.ageMin) return false;
        if (dto.ageMax !== undefined && p.age > dto.ageMax) return false;
        return true;
      });
    }

    const totalPages = Math.ceil(total / limit);

    return {
      patients: filteredPatients,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Convert PatientEntity to PatientResponseDto
   * @param patient - Patient domain entity
   * @returns Patient response DTO for API
   */
  private toResponseDto(patient: PatientEntity): PatientResponseDto {
    return {
      id: patient.id,
      patientId: patient.patientNumber,
      firstName: patient.firstName,
      lastName: patient.lastName,
      fullName: patient.getFullName(),
      dateOfBirth: patient.dateOfBirth.toISOString(),
      age: patient.calculateAge(),
      gender: patient.gender,
      phone: patient.phone,
      email: patient.email || null,
      address: patient.address || null,
      city: null,
      state: null,
      country: 'Nigeria',
      nationality: null,
      occupation: null,
      maritalStatus: null,
      bloodGroup: patient.bloodGroup || null,
      genotype: patient.genotype || null,
      allergies: patient.allergies || [],
      chronicConditions: patient.chronicConditions || [],
      pastSurgicalHistory: patient.pastSurgicalHistory || null,
      emergencyContact: patient.emergencyContact || null,
      nhisNumber: null,
      photoUrl: null,
      status: patient.status,
      hasAllergies: patient.hasAnyAllergies(),
      consentGiven: patient.consentGiven || false,
      consentDate: patient.consentDate ? patient.consentDate.toISOString() : null,
      consentVersion: patient.consentVersion || null,
      createdAt: patient.createdAt.toISOString(),
      updatedAt: patient.updatedAt.toISOString(),
    };
  }
}
