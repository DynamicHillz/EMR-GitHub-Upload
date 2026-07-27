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

    // If phone is being updated, check for duplicates. Exact lookup, not the
    // fuzzy search() this used previously — that matched on ILIKE `contains`
    // across firstName/lastName/patientId/phone/email, so a phone that was a
    // substring of another patient's phone/ID/email (e.g. a typo one digit
    // short) could false-positive as "already exists".
    if (dto.phone && dto.phone !== existingPatient.phone) {
      const duplicate = await this.patientRepository.findByPhone(dto.phone.trim(), tenantId);
      if (duplicate && duplicate.id !== id) {
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
      ...(dto.city !== undefined && { city: dto.city?.trim() }),
      ...(dto.state !== undefined && { state: dto.state?.trim() }),
      ...(dto.lga !== undefined && { lga: dto.lga?.trim() }),
      ...(dto.country !== undefined && { country: dto.country?.trim() }),
      ...(dto.nationality !== undefined && { nationality: dto.nationality?.trim() }),
      ...(dto.occupation !== undefined && { occupation: dto.occupation?.trim() }),
      ...(dto.maritalStatus !== undefined && { maritalStatus: dto.maritalStatus }),
      ...(dto.bloodGroup !== undefined && { bloodGroup: dto.bloodGroup }),
      ...(dto.genotype !== undefined && { genotype: dto.genotype }),
      ...(dto.allergies && { allergies: dto.allergies }),
      ...(dto.chronicConditions && { chronicConditions: dto.chronicConditions }),
      ...(dto.emergencyContact && { emergencyContact: dto.emergencyContact }),
      ...(dto.patientType && { patientType: dto.patientType }),
      ...(dto.hmoProvider !== undefined && { hmoProvider: dto.hmoProvider }),
      ...(dto.hmoNumber !== undefined && { hmoNumber: dto.hmoNumber }),
      ...(dto.nhisNumber !== undefined && { nhisNumber: dto.nhisNumber }),
    };

    // Update patient in database
    const updatedPatient = await this.patientRepository.update(id, tenantId, updateData, dto.version);

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
      version: patient.version,
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
      hmoNumber: patient.hmoNumber,
      photoUrl: patient.photoUrl,
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
