import { PrismaClient } from '@prisma/client';

const STATUS_MAP: Record<string, fhir4.Encounter['status']> = {
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'finished',
  CANCELLED: 'cancelled'
};

export function mapConsultationToFhirEncounter(consultation: {
  id: string;
  patientId: string;
  doctorId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): fhir4.Encounter {
  return {
    resourceType: 'Encounter',
    id: consultation.id,
    status: STATUS_MAP[consultation.status] || 'unknown',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory'
    },
    subject: { reference: `Patient/${consultation.patientId}` },
    participant: [
      {
        individual: { reference: `Practitioner/${consultation.doctorId}` }
      }
    ],
    period: {
      start: consultation.createdAt.toISOString(),
      ...(consultation.status !== 'IN_PROGRESS' ? { end: consultation.updatedAt.toISOString() } : {})
    }
  };
}

export class GetFhirEncounterUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(consultationId: string, tenantId: string): Promise<fhir4.Encounter> {
    const consultation = await this.prisma.consultation.findFirst({
      where: { id: consultationId, tenantId }
    });

    if (!consultation) {
      throw new Error('Consultation not found');
    }

    return mapConsultationToFhirEncounter(consultation);
  }
}
