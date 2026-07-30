import { PrismaClient } from '@prisma/client';

export function mapPatientToFhirPatient(patient: {
  id: string;
  fhirId?: string | null;
  patientId: string;
  status: string;
  lastName: string;
  firstName: string;
  gender: string;
  dateOfBirth: Date;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): fhir4.Patient {
  const fhirPatient: fhir4.Patient = {
    resourceType: 'Patient',
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
    telecom: [],
    gender: patient.gender === 'MALE' ? 'male' : patient.gender === 'FEMALE' ? 'female' : 'unknown',
    birthDate: patient.dateOfBirth.toISOString().split('T')[0],
    address: []
  };

  if (patient.phone) {
    fhirPatient.telecom!.push({
      system: 'phone',
      value: patient.phone,
      use: 'mobile'
    });
  }

  if (patient.email) {
    fhirPatient.telecom!.push({
      system: 'email',
      value: patient.email,
      use: 'home'
    });
  }

  if (patient.address) {
    fhirPatient.address!.push({
      use: 'home',
      text: patient.address,
      city: patient.city || undefined,
      state: patient.state || undefined,
      country: patient.country || undefined
    });
  }

  return fhirPatient;
}

export class GetFhirPatientUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(patientId: string, tenantId: string): Promise<fhir4.Patient> {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        tenantId
      }
    });

    if (!patient) {
      throw new Error('Patient not found');
    }

    // @ts-ignore - Temporary fix for schema alignment (fhirId)
    return mapPatientToFhirPatient(patient);
  }
}
