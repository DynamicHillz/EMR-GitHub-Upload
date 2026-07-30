import { PrismaClient } from '@prisma/client';

interface VitalSignDef {
  code: string;
  display: string;
  field: 'systolicBP' | 'diastolicBP' | 'heartRate' | 'temperature' | 'weight' | 'height' | 'spO2';
  unit: string;
  ucumCode: string;
}

// Universal, standard LOINC codes for common vital signs — these are the
// same codes any FHIR server would use, not something clinic-specific.
export const VITAL_SIGNS: VitalSignDef[] = [
  { code: '8480-6', display: 'Systolic blood pressure', field: 'systolicBP', unit: 'mmHg', ucumCode: 'mm[Hg]' },
  { code: '8462-4', display: 'Diastolic blood pressure', field: 'diastolicBP', unit: 'mmHg', ucumCode: 'mm[Hg]' },
  { code: '8867-4', display: 'Heart rate', field: 'heartRate', unit: 'beats/minute', ucumCode: '/min' },
  { code: '8310-5', display: 'Body temperature', field: 'temperature', unit: 'C', ucumCode: 'Cel' },
  { code: '29463-7', display: 'Body weight', field: 'weight', unit: 'kg', ucumCode: 'kg' },
  { code: '8302-2', display: 'Body height', field: 'height', unit: 'cm', ucumCode: 'cm' },
  { code: '59408-5', display: 'Oxygen saturation', field: 'spO2', unit: '%', ucumCode: '%' }
];

export function vitalObservationId(consultationId: string, loincCode: string): string {
  return `vitals-${consultationId}-${loincCode}`;
}

const INTERPRETATION_MAP: Record<string, { code: string; display: string }> = {
  HIGH: { code: 'H', display: 'High' },
  LOW: { code: 'L', display: 'Low' },
  CRITICAL_HIGH: { code: 'HH', display: 'Critical high' },
  CRITICAL_LOW: { code: 'LL', display: 'Critical low' },
  ABNORMAL: { code: 'A', display: 'Abnormal' }
};

export function mapVitalToFhirObservation(
  consultation: { id: string; patientId: string; createdAt: Date },
  def: VitalSignDef,
  value: number
): fhir4.Observation {
  return {
    resourceType: 'Observation',
    id: vitalObservationId(consultation.id, def.code),
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }
        ]
      }
    ],
    code: {
      coding: [{ system: 'http://loinc.org', code: def.code, display: def.display }],
      text: def.display
    },
    subject: { reference: `Patient/${consultation.patientId}` },
    encounter: { reference: `Encounter/${consultation.id}` },
    effectiveDateTime: consultation.createdAt.toISOString(),
    valueQuantity: {
      value,
      unit: def.unit,
      system: 'http://unitsofmeasure.org',
      code: def.ucumCode
    }
  };
}

export function mapLabResultToFhirObservation(resultValue: {
  id: string;
  numericValue: number | null;
  textValue: string | null;
  isAbnormal: boolean;
  flagType: string | null;
  enteredAt: Date;
  testRecord: { order: { patientId: string; id: string } };
  parameter: { name: string; unit: string | null; loincCode: string | null };
}): fhir4.Observation {
  const { parameter } = resultValue;

  const observation: fhir4.Observation = {
    resourceType: 'Observation',
    id: resultValue.id,
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory'
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: parameter.loincCode ? 'http://loinc.org' : 'http://ststephen-emr.local/lab-parameter',
          code: parameter.loincCode || parameter.name,
          display: parameter.name
        }
      ],
      text: parameter.name
    },
    subject: { reference: `Patient/${resultValue.testRecord.order.patientId}` },
    effectiveDateTime: resultValue.enteredAt.toISOString()
  };

  if (resultValue.numericValue !== null) {
    observation.valueQuantity = {
      value: resultValue.numericValue,
      unit: parameter.unit || undefined
    };
  } else if (resultValue.textValue !== null) {
    observation.valueString = resultValue.textValue;
  }

  const interpretation = resultValue.flagType ? INTERPRETATION_MAP[resultValue.flagType] : null;
  observation.interpretation = [
    {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
          code: interpretation?.code || 'N',
          display: interpretation?.display || 'Normal'
        }
      ]
    }
  ];

  return observation;
}

export class GetFhirObservationUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(id: string, tenantId: string): Promise<fhir4.Observation> {
    if (id.startsWith('vitals-')) {
      return this.executeVital(id, tenantId);
    }
    return this.executeLabResult(id, tenantId);
  }

  private async executeVital(id: string, tenantId: string): Promise<fhir4.Observation> {
    const withoutPrefix = id.slice('vitals-'.length);
    // LOINC codes themselves contain a dash (e.g. "8480-6"), so rather than
    // splitting on the last dash we match against the known VITAL_SIGNS
    // list directly to find where the consultation id ends and the code begins.
    const match = VITAL_SIGNS.find(v => withoutPrefix.endsWith(`-${v.code}`));
    if (!match) {
      throw new Error('Observation not found');
    }
    const consultationId = withoutPrefix.slice(0, withoutPrefix.length - match.code.length - 1);

    const consultation = await this.prisma.consultation.findFirst({
      where: { id: consultationId, tenantId }
    });

    if (!consultation) {
      throw new Error('Observation not found');
    }

    const value = (consultation as any)[match.field];
    if (value === null || value === undefined) {
      throw new Error('Observation not found');
    }

    return mapVitalToFhirObservation(consultation, match, value);
  }

  private async executeLabResult(id: string, tenantId: string): Promise<fhir4.Observation> {
    const resultValue = await this.prisma.labResultValue.findFirst({
      where: { id, tenantId },
      include: {
        testRecord: { include: { order: { select: { id: true, patientId: true } } } },
        parameter: { select: { name: true, unit: true, loincCode: true } }
      }
    });

    if (!resultValue) {
      throw new Error('Observation not found');
    }

    return mapLabResultToFhirObservation(resultValue as any);
  }
}
