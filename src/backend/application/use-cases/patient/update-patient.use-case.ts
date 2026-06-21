/**
 * Update Patient Use Case
 *
 * Updates patient information
 *
 * Features:
 * - Partial updates (only specified fields)
 * - Tenant-scoped (no cross-tenant access)
 * - Validates phone uniqueness if changed
 * - Audit trail through updatedAt timestamp
 */

import { IPatientRepository, PatientUpdateData } from '../../../domain/interfaces/IPatientRepository';
import { UpdatePatientDto, PatientResponseDto } from '../../dtos/patient/RegisterPatient.dto';
import { PatientEntity } from '../../../domain/entities/Patient.entity';
import { NotFoundError, ConflictError } from '../../../shared/errors/AppError';

export class UpdatePatientUseCase {
  constructor(private patientRepository: IPatientRepository) {}

  /**
   * Execute patient update
   * @param id - Patient UUID
   * @param dto - Update data from API request
   * @param tenantId - Tenant ID from authenticated user
   * @returns Updated patient response DTO
   * @throws Error if patient not found or phone already exists
   */
  async execute(id: string, dto: UpdatePatientDto, tenantId: string): Promise<PatientResponseDto> {
    // Verify patient exists
    const existingPatient = await this.patientRepository.findById(id, tenantId);
    if (!existingPatient) {
      throw new NotFoundError('Patient', id);
    }

    // If phone is being updated, check for duplicates
    if (dto.phone && dto.phone !== existingPatient.phone) {
      const duplicateCheck = await this.patientRepository.search({
        tenantId,
        query: dto.phone,
        take: 1,
      });

      if (duplicateCheck.total > 0) {
        throw new ConflictError('A patient with this phone number already exists');
      }
    }

    // Convert DTO to update data
    const updateData: PatientUpdateData = {
      ...(dto.firstName && { firstName: dto.firstName.trim() }),
      ...(dto.lastName && { lastName: dto.lastName.trim() }),
      ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
      ...(dto.gender && { gender: dto.gender }),
      ...(dto.phone && { phone: dto.phone.trim() }),
      ...(dto.email !== undefined && { email: dto.email?.trim() }),
      ...(dto.address !== undefined && { address: dto.address?.trim() }),
      ...(dto.bloodGroup !== undefined && { bloodGroup: dto.bloodGroup }),
      ...(dto.allergies && { allergies: dto.allergies }),
      ...(dto.chronicConditions && { chronicConditions: dto.chronicConditions }),
      ...(dto.emergencyContact && { emergencyContact: dto.emergencyContact }),
    };

    // Update patient in database
    const updatedPatient = await this.patientRepository.update(id, tenantId, updateData);

    // Convert to entity and response DTO
    const patientEntity = PatientEntity.fromDatabase(updatedPatient);
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
