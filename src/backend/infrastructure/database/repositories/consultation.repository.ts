/**
 * Consultation Repository
 *
 * Prisma-based implementation of IConsultationRepository
 * Handles all database operations for consultations
 */

import { PrismaClient, Consultation as PrismaConsultation } from '@prisma/client';
import { Consultation, ConsultationStatus } from '../../../domain/entities/Consultation.entity';
import {
  IConsultationRepository,
  ConsultationCreateData,
  ConsultationUpdateData,
  GetConsultationsOptions,
} from '../../../domain/interfaces/IConsultationRepository';

export class ConsultationRepository implements IConsultationRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find consultation by ID within tenant
   */
  async findById(id: string, tenantId: string): Promise<Consultation | null> {
    const consultation = await this.prisma.consultation.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            allergies: true,
            chronicConditions: true,
          },
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return consultation ? this.mapToEntity(consultation) : null;
  }

  /**
   * Find all consultations for a patient (REQ-CLIN-8: Patient history)
   */
  async findByPatientId(
    patientId: string,
    tenantId: string,
    options?: { limit?: number; skip?: number }
  ): Promise<Consultation[]> {
    const consultations = await this.prisma.consultation.findMany({
      where: {
        patientId,
        tenantId,
      },
      include: {
        doctor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        consultationDate: 'desc',
      },
      take: options?.limit,
      skip: options?.skip,
    });

    return consultations.map(c => this.mapToEntity(c));
  }

  /**
   * Find all consultations for a doctor
   */
  async findByDoctorId(
    doctorId: string,
    tenantId: string,
    options?: { limit?: number; skip?: number }
  ): Promise<Consultation[]> {
    const consultations = await this.prisma.consultation.findMany({
      where: {
        doctorId,
        tenantId,
      },
      include: {
        patient: {
          select: {
            patientId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        consultationDate: 'desc',
      },
      take: options?.limit,
      skip: options?.skip,
    });

    return consultations.map(c => this.mapToEntity(c));
  }

  /**
   * Find consultations with filters
   */
  async find(tenantId: string, options: GetConsultationsOptions): Promise<Consultation[]> {
    const where: any = { tenantId };

    if (options.patientId) {
      where.patientId = options.patientId;
    }

    if (options.doctorId) {
      where.doctorId = options.doctorId;
    }

    if (options.status) {
      where.status = options.status;
    }

    const consultations = await this.prisma.consultation.findMany({
      where,
      include: {
        patient: {
          select: {
            patientId: true,
            firstName: true,
            lastName: true,
          },
        },
        doctor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        consultationDate: 'desc',
      },
      take: options.limit,
      skip: options.skip,
    });

    return consultations.map(c => this.mapToEntity(c));
  }

  /**
   * Create a new consultation
   * REQ-CLIN-2: Auto-calculate BMI if weight and height provided
   */
  async create(data: ConsultationCreateData): Promise<Consultation> {
    // Calculate BMI if weight and height provided
    let bmi: number | null = null;
    if (data.weight && data.height) {
      const heightInMeters = data.height / 100;
      bmi = parseFloat((data.weight / (heightInMeters ** 2)).toFixed(1));
    }

    // Convert ICD-10 codes array to JSON string
    const icd10CodesJson = data.icd10Codes ? JSON.stringify(data.icd10Codes) : null;

    const consultation = await this.prisma.consultation.create({
      data: {
        tenantId: data.tenantId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        subjective: data.subjective || null,
        objective: data.objective || null,
        assessment: data.assessment || null,
        plan: data.plan || null,
        bloodPressure: data.bloodPressure || null,
        heartRate: data.heartRate || null,
        temperature: data.temperature || null,
        weight: data.weight || null,
        height: data.height || null,
        spO2: data.spO2 || null,
        bmi,
        icd10Codes: icd10CodesJson,
        status: 'DRAFT',
        finalizedAt: null,
        consultationDate: new Date(),
      },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            allergies: true,
            chronicConditions: true,
          },
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.mapToEntity(consultation);
  }

  /**
   * Update an existing consultation
   * REQ-CLIN-6: Only allow updates if status is DRAFT
   */
  async update(id: string, tenantId: string, data: ConsultationUpdateData): Promise<Consultation | null> {
    // First, verify consultation exists
    const existing = await this.findById(id, tenantId);

    if (!existing) {
      return null;
    }

    // Note: Business validation (DRAFT status check) should be done in use case layer
    // Recalculate BMI if weight or height changed
    let bmi = existing.bmi;
    const weight = data.weight !== undefined ? data.weight : existing.weight;
    const height = data.height !== undefined ? data.height : existing.height;

    if (weight && height) {
      const heightInMeters = height / 100;
      bmi = parseFloat((weight / (heightInMeters ** 2)).toFixed(1));
    }

    // Convert ICD-10 codes array to JSON string if provided
    const icd10CodesJson = data.icd10Codes ? JSON.stringify(data.icd10Codes) : undefined;

    const consultation = await this.prisma.consultation.update({
      where: { id },
      data: {
        subjective: data.subjective !== undefined ? data.subjective : undefined,
        objective: data.objective !== undefined ? data.objective : undefined,
        assessment: data.assessment !== undefined ? data.assessment : undefined,
        plan: data.plan !== undefined ? data.plan : undefined,
        bloodPressure: data.bloodPressure !== undefined ? data.bloodPressure : undefined,
        heartRate: data.heartRate !== undefined ? data.heartRate : undefined,
        temperature: data.temperature !== undefined ? data.temperature : undefined,
        weight: data.weight !== undefined ? data.weight : undefined,
        height: data.height !== undefined ? data.height : undefined,
        spO2: data.spO2 !== undefined ? data.spO2 : undefined,
        bmi,
        icd10Codes: icd10CodesJson,
        updatedAt: new Date(),
      },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            allergies: true,
            chronicConditions: true,
          },
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.mapToEntity(consultation);
  }

  /**
   * Finalize a consultation (REQ-CLIN-6: Lock consultation)
   * Changes status from DRAFT to FINALIZED
   * Note: Business validation (status check, required fields) should be done in use case layer
   */
  async finalize(id: string, tenantId: string): Promise<Consultation | null> {
    const existing = await this.findById(id, tenantId);

    if (!existing) {
      return null;
    }

    // Note: Business validation should be in use case layer
    const consultation = await this.prisma.consultation.update({
      where: { id },
      data: {
        status: 'FINALIZED',
        finalizedAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            allergies: true,
            chronicConditions: true,
          },
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.mapToEntity(consultation);
  }

  /**
   * Lock a consultation
   * Changes status from FINALIZED to LOCKED
   * Note: Business validation (status check) should be in use case layer
   */
  async lock(id: string, tenantId: string): Promise<Consultation | null> {
    const existing = await this.findById(id, tenantId);

    if (!existing) {
      return null;
    }

    // Note: Business validation should be in use case layer
    const consultation = await this.prisma.consultation.update({
      where: { id },
      data: {
        status: 'LOCKED',
        updatedAt: new Date(),
      },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            allergies: true,
            chronicConditions: true,
          },
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.mapToEntity(consultation);
  }

  /**
   * Delete a consultation
   * For now, we perform hard delete
   * Consider implementing soft delete in the future
   */
  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.findById(id, tenantId);

    if (!existing) {
      throw new Error('Consultation not found');
    }

    await this.prisma.consultation.delete({
      where: { id },
    });
  }

  /**
   * Map Prisma consultation record to domain entity
   */
  private mapToEntity(data: PrismaConsultation): Consultation {
    return {
      id: data.id,
      tenantId: data.tenantId,
      patientId: data.patientId,
      doctorId: data.doctorId,
      subjective: data.subjective,
      objective: data.objective,
      assessment: data.assessment,
      plan: data.plan,
      bloodPressure: data.bloodPressure,
      heartRate: data.heartRate,
      temperature: data.temperature,
      weight: data.weight,
      height: data.height,
      spO2: data.spO2,
      bmi: data.bmi,
      icd10Codes: data.icd10Codes,
      status: data.status as ConsultationStatus,
      finalizedAt: data.finalizedAt,
      consultationDate: data.consultationDate,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}
