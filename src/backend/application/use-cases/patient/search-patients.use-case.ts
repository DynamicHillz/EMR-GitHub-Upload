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

    // Search patients using repository — status/gender/age filters are
    // applied in the DB query itself (not after pagination) so `total`/
    // `totalPages` always match what's actually returned.
    const { patients, total } = await this.patientRepository.search({
      tenantId,
      query: dto.query?.trim(),
      status: dto.status,
      gender: dto.gender,
      ageMin: dto.ageMin,
      ageMax: dto.ageMax,
      lite: dto.lite,
      skip,
      take: limit,
    });

    // Convert to response DTOs
    const patientDtos = patients.map(patient => {
      const patientEntity = PatientEntity.fromDatabase(patient);
      return this.toResponseDto(patientEntity);
    });

    const totalPages = Math.ceil(total / limit);

    return {
      patients: patientDtos,
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
      version: patient.version,
      patientId: patient.patientId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      fullName: patient.getFullName(),
      dateOfBirth: patient.dateOfBirth.toISOString(),
      age: patient.calculateAge(),
      gender: patient.gender,
      phone: patient.phone,
      email: patient.email || null,
      address: patient.address || null,
      city: patient.city || null,
      state: patient.state || null,
      lga: patient.lga || null,
      country: patient.country || 'Nigeria',
      nationality: patient.nationality || null,
      occupation: patient.occupation || null,
      maritalStatus: patient.maritalStatus || null,
      bloodGroup: patient.bloodGroup || null,
      genotype: patient.genotype || null,
      allergies: patient.allergies || [],
      chronicConditions: patient.chronicConditions || [],
      pastSurgicalHistory: patient.pastSurgicalHistory,
      emergencyContact: patient.emergencyContact,
      nhisNumber: patient.nhisNumber,
      patientType: patient.patientType,
      hmoProvider: patient.hmoProvider,
      hmoProviderId: patient.hmoProviderId,
      hmoNumber: patient.hmoNumber,
      photoUrl: patient.photoUrl,
      status: patient.status,
      hasAllergies: patient.hasAnyAllergies(),
      consentGiven: patient.consentGiven || false,
      consentDate: patient.consentDate ? patient.consentDate.toISOString() : null,
      consentVersion: patient.consentVersion || null,
      createdAt: patient.createdAt.toISOString(),
      updatedAt: patient.updatedAt.toISOString(),
      motherPatientId: patient.motherPatientId ?? null,
      mother: patient.mother ?? null,
      newbornChildren: patient.newbornChildren ?? [],
    };
  }
}
