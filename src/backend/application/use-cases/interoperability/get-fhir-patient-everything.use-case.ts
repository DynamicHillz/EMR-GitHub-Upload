import { PrismaClient } from '@prisma/client';
import { mapPatientToFhirPatient } from './get-fhir-patient.use-case';
import { mapConsultationToFhirEncounter } from './get-fhir-encounter.use-case';
import { mapConsultationDiagnosisToFhirCondition, AdditionalCoding, CODE_SYSTEM_MAP } from './get-fhir-condition.use-case';
import { mapVitalToFhirObservation, mapLabResultToFhirObservation, VITAL_SIGNS } from './get-fhir-observation.use-case';
import { mapPrescriptionToFhirMedicationRequest } from './get-fhir-medication-request.use-case';
import { mapLabTestRecordToFhirDiagnosticReport } from './get-fhir-diagnostic-report.use-case';

type FhirResource =
  | fhir4.Encounter
  | fhir4.Condition
  | fhir4.Observation
  | fhir4.MedicationRequest
  | fhir4.DiagnosticReport;

/**
 * A patient's full record, reshaped into one FHIR Bundle — reuses every
 * single-resource mapper above rather than re-implementing the mapping
 * logic, so this and the individual GET /fhir/<Resource>/:id endpoints can
 * never drift out of sync with each other.
 */
export class GetFhirPatientEverythingUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(patientId: string, tenantId: string): Promise<fhir4.Bundle> {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, tenantId } });
    if (!patient) {
      throw new Error('Patient not found');
    }

    const consultations = await this.prisma.consultation.findMany({
      where: { patientId, tenantId }
    });

    const diagnoses = await this.prisma.consultationDiagnosis.findMany({
      where: { tenantId, consultation: { patientId, tenantId } },
      include: {
        consultation: { select: { patientId: true } },
        diagnosis: { select: { code: true, name: true, type: true } }
      }
    });

    // Batch-resolve every diagnosis's code mapping in one query rather than
    // one findMany per diagnosis in the loop below.
    const codingsBySourceKey = await this.resolveAdditionalCodingsForDiagnoses(diagnoses);

    const labResultValues = await this.prisma.labResultValue.findMany({
      where: { tenantId, testRecord: { order: { patientId, tenantId } } },
      include: {
        testRecord: { include: { order: { select: { id: true, patientId: true } } } },
        parameter: { select: { name: true, unit: true, loincCode: true } }
      }
    });

    const prescriptions = await this.prisma.prescription.findMany({
      where: { patientId, tenantId }
    });

    const labTestRecords = await this.prisma.labTestRecord.findMany({
      where: { tenantId, order: { patientId, tenantId } },
      include: {
        order: { select: { patientId: true } },
        test: { select: { name: true, loincCode: true } },
        resultValues: { select: { id: true } }
      }
    });

    const resources: FhirResource[] = [];

    for (const consultation of consultations) {
      resources.push(mapConsultationToFhirEncounter(consultation));

      for (const def of VITAL_SIGNS) {
        const value = (consultation as any)[def.field];
        if (value !== null && value !== undefined) {
          resources.push(mapVitalToFhirObservation(consultation, def, value));
        }
      }
    }

    for (const diagnosis of diagnoses) {
      const key = `${diagnosis.diagnosis.type}|${diagnosis.diagnosis.code}`;
      resources.push(mapConsultationDiagnosisToFhirCondition(diagnosis as any, codingsBySourceKey.get(key) || []));
    }

    for (const resultValue of labResultValues) {
      resources.push(mapLabResultToFhirObservation(resultValue as any));
    }

    for (const prescription of prescriptions) {
      resources.push(mapPrescriptionToFhirMedicationRequest(prescription));
    }

    for (const record of labTestRecords) {
      resources.push(mapLabTestRecordToFhirDiagnosticReport(record as any));
    }

    const allResources: (fhir4.Patient | FhirResource)[] = [mapPatientToFhirPatient(patient as any), ...resources];

    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: allResources.length,
      entry: allResources.map(resource => ({
        fullUrl: `${resource.resourceType}/${resource.id}`,
        resource
      }))
    };
  }

  private async resolveAdditionalCodingsForDiagnoses(
    diagnoses: { diagnosis: { code: string; type: string } }[]
  ): Promise<Map<string, AdditionalCoding[]>> {
    const result = new Map<string, AdditionalCoding[]>();
    if (diagnoses.length === 0) return result;

    const distinctPairs = new Map<string, { sourceSystem: string; sourceCode: string }>();
    for (const d of diagnoses) {
      const key = `${d.diagnosis.type}|${d.diagnosis.code}`;
      if (!distinctPairs.has(key)) {
        distinctPairs.set(key, { sourceSystem: d.diagnosis.type, sourceCode: d.diagnosis.code });
      }
    }

    const mappings = await this.prisma.diagnosisCodeMapping.findMany({
      where: { OR: Array.from(distinctPairs.values()) }
    });

    for (const mapping of mappings) {
      if (!CODE_SYSTEM_MAP[mapping.targetSystem]) continue;
      const key = `${mapping.sourceSystem}|${mapping.sourceCode}`;
      const coding: AdditionalCoding = {
        system: CODE_SYSTEM_MAP[mapping.targetSystem],
        code: mapping.targetCode,
        display: mapping.note || undefined
      };
      if (!result.has(key)) result.set(key, []);
      result.get(key)!.push(coding);
    }

    return result;
  }
}
