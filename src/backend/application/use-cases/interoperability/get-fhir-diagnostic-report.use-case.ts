import { PrismaClient } from '@prisma/client';

const STATUS_MAP: Record<string, fhir4.DiagnosticReport['status']> = {
  PENDING: 'registered',
  IN_PROGRESS: 'partial',
  COMPLETED: 'final',
  REVIEWED: 'final',
  CANCELLED: 'cancelled',
  REJECTED: 'cancelled'
};

export function mapLabTestRecordToFhirDiagnosticReport(record: {
  id: string;
  status: string;
  createdAt: Date;
  reportGeneratedAt: Date | null;
  order: { patientId: string };
  test: { name: string; loincCode: string | null };
  resultValues: { id: string }[];
}): fhir4.DiagnosticReport {
  return {
    resourceType: 'DiagnosticReport',
    id: record.id,
    status: STATUS_MAP[record.status] || 'unknown',
    category: [
      {
        coding: [
          { system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB', display: 'Laboratory' }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: record.test.loincCode ? 'http://loinc.org' : 'http://ststephen-emr.local/lab-test',
          code: record.test.loincCode || record.test.name,
          display: record.test.name
        }
      ],
      text: record.test.name
    },
    subject: { reference: `Patient/${record.order.patientId}` },
    effectiveDateTime: record.createdAt.toISOString(),
    ...(record.reportGeneratedAt ? { issued: record.reportGeneratedAt.toISOString() } : {}),
    result: record.resultValues.map(rv => ({ reference: `Observation/${rv.id}` }))
  };
}

export class GetFhirDiagnosticReportUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(labTestRecordId: string, tenantId: string): Promise<fhir4.DiagnosticReport> {
    const record = await this.prisma.labTestRecord.findFirst({
      where: { id: labTestRecordId, tenantId },
      include: {
        order: { select: { patientId: true } },
        test: { select: { name: true, loincCode: true } },
        resultValues: { select: { id: true } }
      }
    });

    if (!record) {
      throw new Error('Lab test record not found');
    }

    return mapLabTestRecordToFhirDiagnosticReport(record);
  }
}
