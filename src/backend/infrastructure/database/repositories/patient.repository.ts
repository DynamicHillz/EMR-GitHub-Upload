/**
 * Patient Repository Implementation
 *
 * Implements the IPatientRepository interface defined in the domain layer.
 * This is the infrastructure layer's responsibility - handling database operations.
 *
 * Features:
 * - Multi-tenant filtering (all queries scoped by tenantId)
 * - Soft delete support (excludes deleted records)
 * - Search by patient ID, name, or phone
 * - Prisma ORM for type-safe database operations
 */

import { PrismaClient, Prisma, Patient as PrismaPatient } from '@prisma/client';
import {
  IPatientRepository,
  PatientCreateData,
  PatientUpdateData,
  PatientSearchCriteria,
} from '../../../domain/interfaces/IPatientRepository';
import { PatientEntity } from '../../../domain/entities/Patient.entity';

export class PatientRepository implements IPatientRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find a patient by ID
   * @param id - Patient UUID
   * @param tenantId - Tenant ID for multi-tenancy
   * @returns Patient entity or null if not found
   */
  async findById(id: string, tenantId: string): Promise<PatientEntity | null> {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null, // Exclude soft-deleted records
      },
    });

    return patient ? this.mapToEntity(patient) : null;
  }

  /**
   * Find a patient by patient ID (e.g., P0000001)
   * @param patientId - Patient ID in format PXXXXXXX
   * @param tenantId - Tenant ID for multi-tenancy
   * @returns Patient entity or null if not found
   */
  async findByPatientId(
    patientId: string,
    tenantId: string
  ): Promise<PatientEntity | null> {
    const patient = await this.prisma.patient.findFirst({
      where: {
        patientId: patientId,
        tenantId,
        deletedAt: null,
      },
    });

    return patient ? this.mapToEntity(patient) : null;
  }

  /**
   * Search patients by query string
   * US-PAT-003: Search by patient ID, name, or phone
   * @param criteria - Search criteria including query, pagination
   * @returns Array of patients and total count
   */
  async search(criteria: PatientSearchCriteria): Promise<{ patients: PatientEntity[]; total: number }> {
    const { tenantId, query, skip = 0, take = 20 } = criteria;

    const whereClause: Prisma.PatientWhereInput = {
      tenantId,
      deletedAt: null, // Exclude soft-deleted records
    };

    // If query is provided, search by name, patient ID, or phone
    // US-PAT-003: Search by patient ID (exact match), name (partial), phone (partial)
    if (query) {
      const searchTerms = query.trim().split(/\s+/); // Split by whitespace

      if (searchTerms.length === 1) {
        // Single word search - search all fields
        whereClause.OR = [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { patientId: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ];
      } else {
        // Multiple words - assume first name + last name
        whereClause.OR = [
          // Full name match (firstName + lastName)
          {
            AND: [
              { firstName: { contains: searchTerms[0], mode: 'insensitive' } },
              { lastName: { contains: searchTerms.slice(1).join(' '), mode: 'insensitive' } },
            ],
          },
          // Or reverse (lastName + firstName)
          {
            AND: [
              { lastName: { contains: searchTerms[0], mode: 'insensitive' } },
              { firstName: { contains: searchTerms.slice(1).join(' '), mode: 'insensitive' } },
            ],
          },
          // Or any field contains the full query
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { patientId: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ];
      }
    }

    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patient.count({ where: whereClause }),
    ]);

    return {
      patients: patients.map(p => this.mapToEntity(p)),
      total,
    };
  }

  /**
   * Create a new patient
   * US-PAT-001: Patient Registration
   * @param data - Patient creation data
   * @returns Created patient entity
   */
  async create(data: PatientCreateData): Promise<PatientEntity> {
    const patient = await this.prisma.patient.create({
      data: {
        patientId: data.patientId,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        phone: data.phone,
        email: data.email,
        address: data.address,
        bloodGroup: data.bloodGroup,
        allergies: data.allergies || [], // Default to empty array
        chronicConditions: data.chronicConditions || [], // Default to empty array
        emergencyContact: data.emergencyContact ? JSON.stringify(data.emergencyContact) : undefined, // Store as JSON
        consentGiven: data.consentGiven || false, // US-PAT-006: Consent tracking
        consentDate: data.consentGiven ? new Date() : null, // Set timestamp if consent given
        consentVersion: data.consentGiven ? '1.0' : null, // Default version
        tenantId: data.tenantId,
      },
    });

    return this.mapToEntity(patient);
  }

  /**
   * Update a patient
   * @param id - Patient UUID
   * @param tenantId - Tenant ID for multi-tenancy
   * @param data - Patient update data
   * @returns Updated patient entity
   */
  async update(id: string, tenantId: string, data: PatientUpdateData): Promise<PatientEntity> {
    // Verify patient belongs to tenant before updating
    await this.findById(id, tenantId);

    const patient = await this.prisma.patient.update({
      where: { id },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.dateOfBirth && { dateOfBirth: data.dateOfBirth }),
        ...(data.gender && { gender: data.gender }),
        ...(data.phone && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.bloodGroup !== undefined && { bloodGroup: data.bloodGroup }),
        ...(data.allergies && { allergies: data.allergies }),
        ...(data.chronicConditions && { chronicConditions: data.chronicConditions }),
        ...(data.emergencyContact && { emergencyContact: data.emergencyContact ? JSON.stringify(data.emergencyContact) : undefined }),
        updatedAt: new Date(),
      },
    });

    return this.mapToEntity(patient);
  }

  /**
   * Soft delete a patient
   * @param id - Patient UUID
   * @param tenantId - Tenant ID for multi-tenancy
   */
  async delete(id: string, tenantId: string): Promise<void> {
    // Verify patient belongs to tenant before deleting
    await this.findById(id, tenantId);

    // Soft delete - set deletedAt timestamp
    await this.prisma.patient.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Check if patient ID is unique for the tenant
   * @param patientId - Patient ID to check (e.g., P0000001)
   * @param tenantId - Tenant ID for multi-tenancy
   * @returns True if unique, false if already exists
   */
  async isPatientIdUnique(patientId: string, tenantId: string): Promise<boolean> {
    const count = await this.prisma.patient.count({
      where: {
        patientId: patientId,
        tenantId,
        deletedAt: null, // Ignore soft-deleted records
      },
    });

    return count === 0;
  }

  /**
   * Map Prisma patient to domain entity
   * @param patient - Prisma patient record
   * @returns Patient domain entity
   */
  private mapToEntity(patient: PrismaPatient): PatientEntity {
    return PatientEntity.fromDatabase(patient);
  }
}
