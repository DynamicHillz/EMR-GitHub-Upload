/**
 * Get Patient Use Case
 *
 * Retrieves a single patient by ID or patient number
 *
 * Features:
 * - Find by UUID (id)
 * - Find by patient number (e.g., P0000001)
 * - Tenant-scoped (no cross-tenant access)
 * - Returns full patient details
 */

import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { PatientResponseDto } from '../../dtos/patient/RegisterPatient.dto';
import { PatientEntity } from '../../../domain/entities/Patient.entity';
import { NotFoundError } from '../../../shared/errors/AppError';

export class GetPatientUseCase {
  constructor(private patientRepository: IPatientRepository) {}

  /**
   * Get patient by ID (UUID)
   * @param id - Patient UUID
   * @param tenantId - Tenant ID from authenticated user
   * @returns Patient response DTO
   * @throws Error if patient not found
   */
  async executeById(id: string, tenantId: string): Promise<PatientResponseDto> {
    const patient = await this.patientRepository.findById(id, tenantId);

    if (!patient) {
      throw new NotFoundError('Patient');
    }

    const patientEntity = PatientEntity.fromDatabase(patient);
    return this.toResponseDto(patientEntity);
  }

  /**
   * Get patient by patient ID
   * @param patientId - Patient ID (e.g., P0000001)
   * @param tenantId - Tenant ID from authenticated user
   * @returns Patient response DTO
   * @throws Error if patient not found
   */
  async executeByPatientId(
    patientId: string,
    tenantId: string
  ): Promise<PatientResponseDto> {
    const patient = await this.patientRepository.findByPatientId(patientId, tenantId);

    if (!patient) {
      throw new NotFoundError('Patient');
    }

    const patientEntity = PatientEntity.fromDatabase(patient);
    return this.toResponseDto(patientEntity);
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
