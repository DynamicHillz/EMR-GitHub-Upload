import { PrismaClient } from '@prisma/client';
import { mapPatientToFhirPatient } from './get-fhir-patient.use-case';
import { mapConsultationToFhirEncounter } from './get-fhir-encounter.use-case';
import { mapConsultationDiagnosisToFhirCondition } from './get-fhir-condition.use-case';
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
      resources.push(mapConsultationDiagnosisToFhirCondition(diagnosis as any));
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
}
