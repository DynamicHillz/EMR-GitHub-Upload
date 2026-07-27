import { PrismaClient } from '@prisma/client';

export class GetFhirPatientUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(patientId: string, tenantId: string): Promise<any> {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        tenantId
      }
    });

    if (!patient) {
      throw new Error('Patient not found');
    }

    // Map to FHIR R4 Patient resource
    const fhirPatient = {
      resourceType: 'Patient',
      // @ts-ignore - Temporary fix for schema alignment
      id: patient.fhirId || patient.id,
      identifier: [
        {
          use: 'usual',
          system: 'http://ststephen-emr.local/patient-id',
          value: patient.patientId
        }
      ],
      active: patient.status === 'ACTIVE',
      name: [
        {
          use: 'official',
          family: patient.lastName,
          given: [patient.firstName]
        }
      ],
      telecom: [] as any[],
      gender: patient.gender === 'MALE' ? 'male' : patient.gender === 'FEMALE' ? 'female' : 'unknown',
      birthDate: patient.dateOfBirth.toISOString().split('T')[0],
      address: [] as any[]
    };

    if (patient.phone) {
      fhirPatient.telecom.push({
        system: 'phone',
        value: patient.phone,
        use: 'mobile'
      });
    }

    if (patient.email) {
      fhirPatient.telecom.push({
        system: 'email',
        value: patient.email,
        use: 'home'
      });
    }

    if (patient.address) {
      fhirPatient.address.push({
        use: 'home',
        text: patient.address,
        city: patient.city || undefined,
        state: patient.state || undefined,
        country: patient.country || undefined
      });
    }

    return fhirPatient;
  }
}
