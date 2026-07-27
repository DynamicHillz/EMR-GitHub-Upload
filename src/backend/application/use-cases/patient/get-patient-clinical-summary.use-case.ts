/**
 * Get Patient Clinical Summary Use Case
 *
 * Small, bundled read for the "continuity of care" panel shown when a
 * clinician opens a consultation — active medications and recent diagnosis
 * history in one call, so the frontend isn't stitching together two
 * differently-shaped existing endpoints. Direct Prisma, matching the
 * un-refactored (no domain/repository layer) pattern already used by
 * sibling patient use-cases.
 */

import { PrismaClient } from '@prisma/client';

export interface ActiveMedicationDto {
  medicationName: string;
  dosage: string;
  frequency: string;
  prescribedAt: string;
  prescriberName: string;
}

export interface RecentDiagnosisDto {
  code: string;
  name: string;
  diagnosedAt: string;
}

export interface PatientClinicalSummaryDto {
  activePrescriptions: ActiveMedicationDto[];
  recentDiagnoses: RecentDiagnosisDto[];
}

export class GetPatientClinicalSummaryUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(patientId: string, tenantId: string): Promise<PatientClinicalSummaryDto> {
    const [prescriptions, diagnoses] = await Promise.all([
      this.prisma.prescription.findMany({
        where: {
          patientId,
          tenantId,
          status: { in: ['PENDING', 'DISPENSED'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          doctor: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.consultationDiagnosis.findMany({
        where: {
          tenantId,
          consultation: { patientId },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          diagnosis: { select: { code: true, name: true } },
        },
      }),
    ]);

    return {
      activePrescriptions: prescriptions.map((p) => ({
        medicationName: p.medicationName,
        dosage: p.dosage,
        frequency: p.frequency,
        prescribedAt: p.createdAt.toISOString(),
        prescriberName: `${p.doctor.firstName} ${p.doctor.lastName}`,
      })),
      recentDiagnoses: diagnoses.map((d) => ({
        code: d.diagnosis.code,
        name: d.diagnosis.name,
        diagnosedAt: d.createdAt.toISOString(),
      })),
    };
  }
}
