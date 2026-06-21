/**
 * Register Patient Use Case
 *
 * US-PAT-001: Patient Registration
 *
 * Use cases encapsulate application-specific business rules.
 * They orchestrate the flow of data between the domain and presentation layers.
 *
 * Responsibilities:
 * - Auto-generate unique patient ID (PXXXXXXX format)
 * - Validate business rules (phone uniqueness, consent requirement)
 * - Coordinate between repository and domain entities
 * - Transform data between DTOs and domain entities
 */

import { IPatientRepository, PatientCreateData } from '../../../domain/interfaces/IPatientRepository';
import { RegisterPatientDto, PatientResponseDto } from '../../dtos/patient/RegisterPatient.dto';
import { PatientIdGenerator } from '../../../infrastructure/generators/patient-id.generator';
import { PatientEntity } from '../../../domain/entities/Patient.entity';
import { ConflictError } from '../../../shared/errors/AppError';

export class RegisterPatientUseCase {
  constructor(
    private patientRepository: IPatientRepository,
    private patientIdGenerator: PatientIdGenerator
  ) {}

  /**
   * Execute patient registration
   * @param dto - Registration data from API request
   * @param tenantId - Tenant ID from authenticated user
   * @returns Patient response DTO
   * @throws Error if phone number already exists for this tenant
   */
  async execute(dto: RegisterPatientDto, tenantId: string): Promise<PatientResponseDto> {
    // US-PAT-001: Auto-generate patient ID in PXXXXXXX format
    const patientId = await this.patientIdGenerator.generatePatientId(tenantId);

    // US-PAT-001: Check for duplicate phone number per tenant
    // This is enforced by unique constraint in schema, but we check explicitly for better error message
    const existingPatient = await this.patientRepository.search({
      tenantId,
      query: dto.phone,
      take: 1,
    });

    if (existingPatient.total > 0) {
      throw new ConflictError('A patient with this phone number already exists');
    }

    // Convert DTO to domain data
    const patientData: PatientCreateData = {
      patientId: patientId,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      dateOfBirth: new Date(dto.dateOfBirth),
      gender: dto.gender,
      phone: dto.phone.trim(),
      email: dto.email?.trim(),
      address: dto.address?.trim(),
      bloodGroup: dto.bloodGroup,
      allergies: dto.allergies || [],
      chronicConditions: dto.chronicConditions || [],
      emergencyContact: dto.emergencyContact,
      consentGiven: dto.consentGiven, // US-PAT-006: Include consent data
      tenantId,
    };

    // Create patient in database
    const patient = await this.patientRepository.create(patientData);

    // Convert domain entity to PatientEntity for business methods
    const patientEntity = PatientEntity.fromDatabase(patient);

    // Convert to response DTO
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
      city: null, // Will be added later
      state: null, // Will be added later
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
