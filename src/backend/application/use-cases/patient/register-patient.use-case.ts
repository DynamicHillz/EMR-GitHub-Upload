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
import { PrismaClient } from '@prisma/client';

export class RegisterPatientUseCase {
  constructor(
    private patientRepository: IPatientRepository,
    private patientIdGenerator: PatientIdGenerator,
    private prisma: PrismaClient
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
    const existingPatient = await this.prisma.patient.findUnique({
      where: {
        tenantId_phone: {
          tenantId,
          phone: dto.phone.trim()
        }
      }
    });

    if (existingPatient) {
      // @ts-ignore - Temporary fix for schema alignment
      if (existingPatient.isDeleted) {
        throw new ConflictError('A deleted patient with this phone number already exists. Please contact support or restore the patient.');
      }
      throw new ConflictError('A patient with this phone number already exists');
    }

    // Convert DTO to domain data
    const patientData: PatientCreateData = {
      id: dto.id,
      patientId: patientId,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      dateOfBirth: new Date(dto.dateOfBirth),
      gender: dto.gender,
      phone: dto.phone.trim(),
      email: dto.email?.trim(),
      address: dto.address?.trim(),
      city: dto.city?.trim(),
      state: dto.state?.trim(),
      lga: dto.lga?.trim(),
      country: dto.country?.trim() || 'Nigeria',
      nationality: dto.nationality?.trim(),
      occupation: dto.occupation?.trim(),
      maritalStatus: dto.maritalStatus,
      bloodGroup: dto.bloodGroup,
      genotype: dto.genotype,
      allergies: dto.allergies || [],
      chronicConditions: dto.chronicConditions || [],
      emergencyContact: dto.emergencyContact,
      patientType: dto.patientType,
      hmoProvider: dto.hmoProvider,
      hmoProviderId: dto.hmoProviderId,
      hmoNumber: dto.hmoNumber,
      nhisNumber: dto.nhisNumber,
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
      motherPatientId: null,
      mother: null,
      newbornChildren: [],
    };
  }
}
