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
import { ConflictError } from '../../../shared/errors/AppError';

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
        isDeleted: false,
      },
      include: {
        // @ts-ignore - Temporary fix for schema alignment
        diagnoses: { include: { diagnosis: true } },
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
        isDeleted: false,
      },
      include: {
        // @ts-ignore - Temporary fix for schema alignment
        diagnoses: { include: { diagnosis: true } },
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
        isDeleted: false,
      },
      include: {
        // @ts-ignore - Temporary fix for schema alignment
        diagnoses: { include: { diagnosis: true } },
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
    const where: any = { tenantId, isDeleted: false };

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
        // @ts-ignore - Temporary fix for schema alignment
        diagnoses: { include: { diagnosis: true } },
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
   * Helper to ensure diagnoses from external APIs (like WHO Docker) exist locally
   */
  private async ensureDiagnosesExist(tenantId: string, diagnoses: any[]) {
    if (!diagnoses || diagnoses.length === 0) return;
    for (const diag of diagnoses) {
      if (diag.code && diag.name) {
        const catalogEntry = await this.prisma.diagnosisCatalog.upsert({
          where: { tenantId_code: { tenantId, code: diag.code } },
          update: { name: diag.name, type: diag.type || 'ICD-11' },
          create: {
            tenantId,
            code: diag.code,
            name: diag.name,
            type: diag.type || 'ICD-11',
            isActive: true,
          }
        });
        // Replace the transient external ID with the local DB UUID
        diag.diagnosisId = catalogEntry.id;
      }
    }
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

    if (data.diagnoses) {
      await this.ensureDiagnosesExist(data.tenantId, data.diagnoses);
    }

    const diagnosesCreate = data.diagnoses ? {
      create: data.diagnoses.map(d => ({
        tenantId: data.tenantId,
        diagnosisId: d.diagnosisId,
        isPrimary: d.isPrimary,
        notes: d.notes,
      }))
    } : undefined;

    const consultation = await this.prisma.consultation.create({
      data: {
        tenantId: data.tenantId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        subjective: data.subjective || null,
        objective: data.objective || null,
        assessment: data.assessment || null,
        plan: data.plan || null,
        systolicBP: data.bloodPressure ? parseInt(data.bloodPressure.split('/')[0]) : (data.systolicBP || null),
        diastolicBP: data.bloodPressure ? parseInt(data.bloodPressure.split('/')[1]) : (data.diastolicBP || null),
        heartRate: data.heartRate || null,
        temperature: data.temperature || null,
        weight: data.weight || null,
        height: data.height || null,
        spO2: data.spO2 || null,
        bmi,
        icd10Codes: data.icd10Codes || null,
        diagnoses: diagnosesCreate,
        status: 'IN_PROGRESS',
        finalizedAt: null,
        consultationDate: new Date(),
      },
      include: {
        diagnoses: { include: { diagnosis: true } },
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
  async update(id: string, tenantId: string, data: ConsultationUpdateData, expectedVersion?: number): Promise<Consultation | null> {
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

    if (data.diagnoses) {
      await this.ensureDiagnosesExist(tenantId, data.diagnoses);
    }

    let diagnosesUpdate: any;
    if (data.diagnoses) {
      diagnosesUpdate = {
        deleteMany: {},
        create: data.diagnoses.map(d => ({
          tenantId,
          diagnosisId: d.diagnosisId,
          isPrimary: d.isPrimary,
          notes: d.notes,
        }))
      };
    }

    // Version bump and the actual SOAP-note write used to be two separate,
    // non-transactional calls — a crash/error between them left the version
    // incremented with the doctor's note never actually saved. Same
    // transaction now, so both succeed or both roll back together.
    const consultation = await this.prisma.$transaction(async (tx) => {
      if (expectedVersion !== undefined) {
        const versionCheck = await tx.consultation.updateMany({
          where: { id, tenantId, version: expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (versionCheck.count === 0) {
          throw new ConflictError('This consultation was changed by someone else. Please reload and try again.');
        }
      } else {
        await tx.consultation.updateMany({ where: { id, tenantId }, data: { version: { increment: 1 } } });
      }

      return tx.consultation.update({
        where: { id },
        data: {
          subjective: data.subjective !== undefined ? data.subjective : undefined,
          objective: data.objective !== undefined ? data.objective : undefined,
          assessment: data.assessment !== undefined ? data.assessment : undefined,
          plan: data.plan !== undefined ? data.plan : undefined,
          systolicBP: data.bloodPressure ? parseInt(data.bloodPressure.split('/')[0]) : (data.systolicBP !== undefined ? data.systolicBP : undefined),
          diastolicBP: data.bloodPressure ? parseInt(data.bloodPressure.split('/')[1]) : (data.diastolicBP !== undefined ? data.diastolicBP : undefined),
          heartRate: data.heartRate !== undefined ? data.heartRate : undefined,
          temperature: data.temperature !== undefined ? data.temperature : undefined,
          weight: data.weight !== undefined ? data.weight : undefined,
          height: data.height !== undefined ? data.height : undefined,
          spO2: data.spO2 !== undefined ? data.spO2 : undefined,
          ...(bmi !== null ? { bmi } : {}),
          icd10Codes: data.icd10Codes !== undefined ? data.icd10Codes : undefined,
          diagnoses: diagnosesUpdate,
          updatedAt: new Date(),
        },
        include: {
          diagnoses: { include: { diagnosis: true } },
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
        status: 'COMPLETED',
        finalizedAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        // @ts-ignore - Temporary fix for schema alignment
        diagnoses: { include: { diagnosis: true } },
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
        status: 'COMPLETED',
        updatedAt: new Date(),
      },
      include: {
        // @ts-ignore - Temporary fix for schema alignment
        diagnoses: { include: { diagnosis: true } },
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
   * Uses soft delete to preserve medical records
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<void> {
    const existing = await this.findById(id, tenantId);

    if (!existing) {
      throw new Error('Consultation not found');
    }

    await this.prisma.consultation.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
        updatedAt: new Date(),
      },
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
      // @ts-ignore - Temporary fix for schema alignment
      systolicBP: data.systolicBP,
      diastolicBP: data.diastolicBP,
      heartRate: data.heartRate,
      // @ts-ignore - Temporary fix for schema alignment
      respiratoryRate: data.respiratoryRate,
      temperature: data.temperature,
      weight: data.weight,
      height: data.height,
      // @ts-ignore - Temporary fix for schema alignment
      headCircumference: data.headCircumference,
      // @ts-ignore - Temporary fix for schema alignment
      muac: data.muac,
      spO2: data.spO2,
      bmi: data.bmi,
      // @ts-ignore - Temporary fix for schema alignment
      zScoreWeightForAge: data.zScoreWeightForAge,
      // @ts-ignore - Temporary fix for schema alignment
      zScoreHeightForAge: data.zScoreHeightForAge,
      // @ts-ignore - Temporary fix for schema alignment
      zScoreWeightForHeight: data.zScoreWeightForHeight,
      // @ts-ignore - Temporary fix for schema alignment
      zScoreBMIForAge: data.zScoreBMIForAge,
      diagnoses: (data as any).diagnoses || [],
      icd10Codes: (data as any).icd10Codes ? JSON.parse((data as any).icd10Codes) : undefined,
      status: data.status === 'COMPLETED' ? ConsultationStatus.FINALIZED : (data.status === 'CANCELLED' ? ConsultationStatus.LOCKED : ConsultationStatus.DRAFT),
      billingStatus: (data as any).billingStatus || 'UNBILLED',
      finalizedAt: data.finalizedAt,
      consultationDate: data.consultationDate,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      // @ts-ignore - Temporary fix for schema alignment
      version: data.version,
    };
  }
}
