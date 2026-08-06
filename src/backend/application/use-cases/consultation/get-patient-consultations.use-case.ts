/**
 * Get Patient Consultations Use Case
 *
 * Business logic for retrieving patient consultation history
 * REQ-CLIN-8: Auto-populate patient medical history
 */

import { PrismaClient } from '@prisma/client';

interface PatientConsultationSummary {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  status: string;
  billingStatus: string;
  consultationDate: string;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  vitalSigns?: any;
  prescriptions?: any[];
}

export class GetPatientConsultationsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    patientId: string,
    tenantId: string,
    options?: { limit?: number; skip?: number }
  ): Promise<PatientConsultationSummary[]> {
    const consultations = await this.prisma.consultation.findMany({
      where: { patientId, tenantId, isDeleted: false },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { firstName: true, lastName: true } },
        prescriptions: true
      },
      orderBy: { consultationDate: 'desc' },
      take: options?.limit,
      skip: options?.skip
    });

    return consultations.map(c => ({
      id: c.id,
      patientId: c.patientId,
      patientName: c.patient ? `${c.patient.firstName} ${c.patient.lastName}` : '',
      doctorId: c.doctorId,
      doctorName: c.doctor ? `${c.doctor.firstName} ${c.doctor.lastName}` : '',
      subjective: c.subjective,
      objective: c.objective,
      assessment: c.assessment,
      plan: c.plan,
      status: c.status,
      billingStatus: (c as any).billingStatus || 'UNBILLED',
      consultationDate: c.consultationDate.toISOString(),
      finalizedAt: c.finalizedAt ? c.finalizedAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      vitalSigns: {
        bloodPressure: c.systolicBP && c.diastolicBP ? `${c.systolicBP}/${c.diastolicBP}` : null,
        heartRate: c.heartRate,
        // @ts-ignore - Temporary fix for schema alignment
        respiratoryRate: c.respiratoryRate,
        temperature: c.temperature,
        weight: c.weight,
        height: c.height,
        // @ts-ignore - Temporary fix for schema alignment
        headCircumference: c.headCircumference,
        // @ts-ignore - Temporary fix for schema alignment
        muac: c.muac,
        spO2: c.spO2,
        bmi: c.bmi
      },
      prescriptions: c.prescriptions
    }));
  }
}
