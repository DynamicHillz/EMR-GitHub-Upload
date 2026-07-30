import { PrismaClient } from '@prisma/client';

const STATUS_MAP: Record<string, fhir4.MedicationRequest['status']> = {
  PENDING: 'active',
  DISPENSED: 'completed',
  CANCELLED: 'cancelled'
};

export function mapPrescriptionToFhirMedicationRequest(prescription: {
  id: string;
  patientId: string;
  doctorId: string;
  status: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  createdAt: Date;
}): fhir4.MedicationRequest {
  const dosageText = [prescription.dosage, prescription.frequency, prescription.duration]
    .filter(Boolean)
    .join(', ');

  return {
    resourceType: 'MedicationRequest',
    id: prescription.id,
    status: STATUS_MAP[prescription.status] || 'unknown',
    intent: 'order',
    // No drug-coding system (e.g. RxNorm) exists in this schema yet, so this
    // stays text rather than fabricating a code that was never assigned.
    medicationCodeableConcept: { text: prescription.medicationName },
    subject: { reference: `Patient/${prescription.patientId}` },
    requester: { reference: `Practitioner/${prescription.doctorId}` },
    authoredOn: prescription.createdAt.toISOString(),
    dosageInstruction: [
      {
        text: prescription.instructions ? `${dosageText} — ${prescription.instructions}` : dosageText
      }
    ]
  };
}

export class GetFhirMedicationRequestUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(prescriptionId: string, tenantId: string): Promise<fhir4.MedicationRequest> {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId, tenantId }
    });

    if (!prescription) {
      throw new Error('Prescription not found');
    }

    return mapPrescriptionToFhirMedicationRequest(prescription);
  }
}
