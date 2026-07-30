import { PrismaClient } from '@prisma/client';

const VERIFICATION_STATUS_MAP: Record<string, string> = {
  CONFIRMED: 'confirmed',
  PROVISIONAL: 'provisional',
  DIFFERENTIAL: 'differential',
  RULED_OUT: 'refuted'
};

// Real, correct system URIs per catalog type — never a placeholder, since
// DiagnosisCatalog.type only ever holds one of these two values.
const CODE_SYSTEM_MAP: Record<string, string> = {
  'ICD-11': 'http://id.who.int/icd/release/11/mms',
  'ICD-10': 'http://hl7.org/fhir/sid/icd-10'
};

export function mapConsultationDiagnosisToFhirCondition(record: {
  id: string;
  isPrimary: boolean;
  certainty: string;
  consultation: { patientId: string };
  diagnosis: { code: string; name: string; type: string };
}): fhir4.Condition {
  return {
    resourceType: 'Condition',
    id: record.id,
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active'
        }
      ]
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: VERIFICATION_STATUS_MAP[record.certainty] || 'unconfirmed'
        }
      ]
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: record.isPrimary ? 'encounter-diagnosis' : 'problem-list-item'
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: CODE_SYSTEM_MAP[record.diagnosis.type] || undefined,
          code: record.diagnosis.code,
          display: record.diagnosis.name
        }
      ],
      text: record.diagnosis.name
    },
    subject: { reference: `Patient/${record.consultation.patientId}` }
  };
}

export class GetFhirConditionUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(consultationDiagnosisId: string, tenantId: string): Promise<fhir4.Condition> {
    const record = await this.prisma.consultationDiagnosis.findFirst({
      where: { id: consultationDiagnosisId, tenantId },
      include: {
        consultation: { select: { patientId: true } },
        diagnosis: { select: { code: true, name: true, type: true } }
      }
    });

    if (!record) {
      throw new Error('Diagnosis record not found');
    }

    return mapConsultationDiagnosisToFhirCondition(record);
  }
}
