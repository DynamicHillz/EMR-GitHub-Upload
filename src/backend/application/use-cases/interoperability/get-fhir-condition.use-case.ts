import { PrismaClient } from '@prisma/client';
import { ResolveDiagnosisCodeMappingUseCase } from '../clinical/resolve-diagnosis-code-mapping.use-case';

const VERIFICATION_STATUS_MAP: Record<string, string> = {
  CONFIRMED: 'confirmed',
  PROVISIONAL: 'provisional',
  DIFFERENTIAL: 'differential',
  RULED_OUT: 'refuted'
};

// Real, correct system URIs per catalog type — never a placeholder, since
// DiagnosisCatalog.type only ever holds one of these two values. Exported
// so get-fhir-patient-everything.use-case.ts's batch mapping resolution
// reuses this instead of duplicating it.
export const CODE_SYSTEM_MAP: Record<string, string> = {
  'ICD-11': 'http://id.who.int/icd/release/11/mms',
  'ICD-10': 'http://hl7.org/fhir/sid/icd-10'
};

export interface AdditionalCoding {
  system: string;
  code: string;
  display?: string;
}

export function mapConsultationDiagnosisToFhirCondition(
  record: {
    id: string;
    isPrimary: boolean;
    certainty: string;
    consultation: { patientId: string };
    diagnosis: { code: string; name: string; type: string };
  },
  additionalCodings: AdditionalCoding[] = []
): fhir4.Condition {
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
      // FHIR's code.coding is an array precisely so a single concept can
      // carry more than one code system — attaching a resolved ICD-10<->
      // ICD-11 equivalent here (see DiagnosisCodeMapping) is the standards-
      // correct place for it, not a workaround.
      coding: [
        {
          system: CODE_SYSTEM_MAP[record.diagnosis.type] || undefined,
          code: record.diagnosis.code,
          display: record.diagnosis.name
        },
        ...additionalCodings
      ],
      text: record.diagnosis.name
    },
    subject: { reference: `Patient/${record.consultation.patientId}` }
  };
}

export class GetFhirConditionUseCase {
  private resolveMappingUseCase: ResolveDiagnosisCodeMappingUseCase;

  constructor(private prisma: PrismaClient) {
    this.resolveMappingUseCase = new ResolveDiagnosisCodeMappingUseCase(prisma);
  }

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

    const additionalCodings = await this.resolveAdditionalCodings(record.diagnosis.type, record.diagnosis.code);

    return mapConsultationDiagnosisToFhirCondition(record, additionalCodings);
  }

  private async resolveAdditionalCodings(sourceSystem: string, sourceCode: string): Promise<AdditionalCoding[]> {
    const mappings = await this.resolveMappingUseCase.execute(sourceSystem, sourceCode);
    return mappings
      .filter((m) => CODE_SYSTEM_MAP[m.targetSystem])
      .map((m) => ({
        system: CODE_SYSTEM_MAP[m.targetSystem],
        code: m.targetCode,
        display: m.note || undefined
      }));
  }
}
