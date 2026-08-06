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
import { ConflictError, NotFoundError } from '../../../shared/errors/AppError';

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
        // @ts-ignore - Temporary fix for schema alignment
        isDeleted: false,
        deletedAt: null, // Exclude soft-deleted records
      },
      include: {
        PatientAllergy: true,
        // Newborn linkage (see record-delivery-outcome.use-case.ts) — lets
        // PatientDetailView.tsx cross-link mother <-> newborn charts.
        mother: { select: { id: true, patientId: true, firstName: true, lastName: true } },
        newbornChildren: { select: { id: true, patientId: true, firstName: true, lastName: true } },
      }
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
        // @ts-ignore - Temporary fix for schema alignment
        isDeleted: false,
        deletedAt: null,
      },
      include: {
        PatientAllergy: true,
      }
    });

    return patient ? this.mapToEntity(patient) : null;
  }

  async findByPhone(phone: string, tenantId: string): Promise<PatientEntity | null> {
    // Exact match on the tenantId_phone unique index — deliberately includes
    // soft-deleted rows (unlike most other lookups here), matching
    // register-patient.use-case.ts's duplicate check, which needs to
    // distinguish "phone belongs to an active patient" from "phone belongs
    // to a soft-deleted one" rather than a fuzzy substring match that could
    // false-positive/false-negative against unrelated patients' data.
    const patient = await this.prisma.patient.findUnique({
      where: {
        tenantId_phone: { tenantId, phone },
      },
      include: {
        PatientAllergy: true,
      }
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
    const { tenantId, query, status, gender, ageMin, ageMax, skip = 0, take = 20, lite = false } = criteria;

    const whereClause: Prisma.PatientWhereInput = {
      tenantId,
      // @ts-ignore - Temporary fix for schema alignment
      isDeleted: false,
      deletedAt: null, // Exclude soft-deleted records
    };

    // Filtered here (not post-processed in JS after pagination) so `total`/
    // `totalPages` returned to the client always match what's actually
    // returned — filtering after skip/take made the two disagree, e.g. "42
    // results, page 1 of 3" while page 2 came back with only a handful of rows.
    if (status && status !== 'ALL') {
      whereClause.status = status as any;
    }
    if (gender) {
      whereClause.gender = gender as any;
    }
    if (ageMin !== undefined || ageMax !== undefined) {
      const now = new Date();
      const dobFilter: Prisma.DateTimeFilter = {};
      if (ageMax !== undefined) {
        // A patient no older than ageMax was born on/after this date.
        const minBirthDate = new Date(now);
        minBirthDate.setFullYear(minBirthDate.getFullYear() - ageMax - 1);
        minBirthDate.setDate(minBirthDate.getDate() + 1);
        dobFilter.gte = minBirthDate;
      }
      if (ageMin !== undefined) {
        // A patient at least ageMin was born on/before this date.
        const maxBirthDate = new Date(now);
        maxBirthDate.setFullYear(maxBirthDate.getFullYear() - ageMin);
        dobFilter.lte = maxBirthDate;
      }
      whereClause.dateOfBirth = dobFilter;
    }

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
          { phone: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
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
          { phone: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ];
      }
    }

    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        ...(lite ? {} : { include: { PatientAllergy: true } }),
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
        // Honor a client-generated id when present — the offline queue
        // relies on this (see sync.controller.ts's applyCreate) so a
        // patient created while offline keeps the same id the rest of that
        // session's offline-created records (e.g. a Triage) already
        // reference, whether this write lands immediately or on replay.
        id: data.id || undefined,
        patientId: data.patientId,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        phone: data.phone,
        email: data.email,
        address: data.address,
        city: data.city,
        state: data.state,
        lga: data.lga,
        country: data.country || 'Nigeria',
        nationality: data.nationality,
        occupation: data.occupation,
        bloodGroup: data.bloodGroup as any,
        genotype: (data as any).genotype as any,
        maritalStatus: (data as any).maritalStatus as any,
        allergies: data.allergies || [], // Default to empty array
        PatientAllergy: data.patientAllergies?.length ? {
          create: data.patientAllergies.map(a => ({
            tenantId: data.tenantId,
            allergen: a.allergen,
            reactionType: a.reactionType,
            severity: a.severity,
            onsetDate: a.onsetDate,
            notes: a.notes,
          }))
        } : undefined,
        chronicConditions: data.chronicConditions || [], // Default to empty array
        patientType: data.patientType || 'PRIVATE',
        hmoProvider: data.hmoProvider,
        hmoProviderId: data.hmoProviderId,
        hmoNumber: data.hmoNumber,
        nhisNumber: data.nhisNumber,
        emergencyContact: data.emergencyContact ? (data.emergencyContact as any) : undefined,
        consentGiven: data.consentGiven || false, // US-PAT-006: Consent tracking
        consentDate: data.consentGiven ? new Date() : null, // Set timestamp if consent given
        consentVersion: data.consentGiven ? '1.0' : null, // Default version
        tenantId: data.tenantId,
      },
      include: {
        PatientAllergy: true,
      }
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
  async update(id: string, tenantId: string, data: PatientUpdateData, expectedVersion?: number): Promise<PatientEntity> {
    // Verify patient belongs to tenant before updating — the return value
    // was previously discarded (a null here fell through to the writes
    // below, which were themselves only scoped by {id}, not {id, tenantId}
    // — no tenant isolation on the actual write, only on this check).
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new NotFoundError('Patient', id);
    }

    const patient = await this.prisma.$transaction(async (tx) => {
      // Optimistic concurrency check — only enforced when a caller (the
      // offline-sync push path) actually supplies the version it read.
      // Ordinary online edits that don't pass one behave exactly as before.
      if (expectedVersion !== undefined) {
        const versionCheck = await tx.patient.updateMany({
          where: { id, tenantId, version: expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (versionCheck.count === 0) {
          throw new ConflictError('This patient record was changed by someone else. Please reload and try again.');
        }
      } else {
        await tx.patient.updateMany({ where: { id, tenantId }, data: { version: { increment: 1 } } });
      }

      // updateMany (not update) so this write itself is tenant-scoped, not
      // just the pre-check above — defense in depth for any future caller
      // that skips the use-case's own tenant validation. updateMany can't
      // return the row/include relations (or take nested-relation writes,
      // hence PatientAllergy is handled as its own explicitly-scoped step
      // below instead of a nested `create`), so re-fetch at the end.
      await tx.patient.updateMany({
        where: { id, tenantId },
        data: {
          ...(data.firstName && { firstName: data.firstName }),
          ...(data.lastName && { lastName: data.lastName }),
          ...(data.dateOfBirth && { dateOfBirth: data.dateOfBirth }),
          ...(data.gender && { gender: data.gender }),
          ...(data.phone && { phone: data.phone }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.address !== undefined && { address: data.address }),
          ...(data.city !== undefined && { city: data.city }),
          ...(data.state !== undefined && { state: data.state }),
          ...(data.lga !== undefined && { lga: data.lga }),
          ...(data.country !== undefined && { country: data.country }),
          ...(data.nationality !== undefined && { nationality: data.nationality }),
          ...(data.occupation !== undefined && { occupation: data.occupation }),
          ...(data.bloodGroup !== undefined && { bloodGroup: data.bloodGroup as any }),
          ...((data as any).genotype !== undefined && { genotype: (data as any).genotype as any }),
          ...((data as any).maritalStatus !== undefined && { maritalStatus: (data as any).maritalStatus as any }),
          ...(data.allergies && { allergies: data.allergies }),
          ...(data.chronicConditions && { chronicConditions: data.chronicConditions }),
          ...(data.emergencyContact && { emergencyContact: data.emergencyContact as any }),
          ...(data.patientType !== undefined && { patientType: data.patientType }),
          ...(data.hmoProvider !== undefined && { hmoProvider: data.hmoProvider }),
          ...(data.hmoProviderId !== undefined && { hmoProviderId: data.hmoProviderId }),
          ...(data.hmoNumber !== undefined && { hmoNumber: data.hmoNumber }),
          ...(data.nhisNumber !== undefined && { nhisNumber: data.nhisNumber }),
          updatedAt: new Date(),
        },
      });

      if (data.patientAllergies) {
        // Simplest approach for updates: delete existing and recreate.
        // Scoped by patientId (== id) and tenantId, not a bare nested write.
        await tx.patientAllergy.deleteMany({ where: { patientId: id, tenantId } });
        if (data.patientAllergies.length > 0) {
          await tx.patientAllergy.createMany({
            data: data.patientAllergies.map(a => ({
              tenantId,
              patientId: id,
              allergen: a.allergen,
              reactionType: a.reactionType,
              severity: a.severity,
              onsetDate: a.onsetDate,
              notes: a.notes,
            })),
          });
        }
      }

      return tx.patient.findUniqueOrThrow({
        where: { id },
        include: { PatientAllergy: true },
      });
    });

    return this.mapToEntity(patient);
  }

  /**
   * Soft delete a patient
   * @param id - Patient UUID
   * @param tenantId - Tenant ID for multi-tenancy
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<void> {
    // Verify patient belongs to tenant before deleting — same reasoning as
    // update() above: the return value was previously discarded (a null
    // here fell through to the write below, which was itself only scoped
    // by {id}, not {id, tenantId} — no tenant isolation on the actual
    // write, only on this check, which wasn't even being checked).
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new NotFoundError('Patient', id);
    }

    // updateMany (not update) so this write itself is tenant-scoped, not
    // just the pre-check above.
    await this.prisma.patient.updateMany({
      where: { id, tenantId },
      data: {
        // @ts-ignore - Temporary fix for schema alignment
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
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
        // @ts-ignore - Temporary fix for schema alignment
        isDeleted: false,
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
