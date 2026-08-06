import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { GetFhirPatientUseCase } from '../../application/use-cases/interoperability/get-fhir-patient.use-case';
import { GetFhirEncounterUseCase } from '../../application/use-cases/interoperability/get-fhir-encounter.use-case';
import { GetFhirConditionUseCase } from '../../application/use-cases/interoperability/get-fhir-condition.use-case';
import { GetFhirObservationUseCase } from '../../application/use-cases/interoperability/get-fhir-observation.use-case';
import { GetFhirMedicationRequestUseCase } from '../../application/use-cases/interoperability/get-fhir-medication-request.use-case';
import { GetFhirDiagnosticReportUseCase } from '../../application/use-cases/interoperability/get-fhir-diagnostic-report.use-case';
import { GetFhirPatientEverythingUseCase } from '../../application/use-cases/interoperability/get-fhir-patient-everything.use-case';
import { SyncDhis2AggregateUseCase } from '../../application/use-cases/interoperability/sync-dhis2-aggregate.use-case';
import { GetDhis2ConfigUseCase } from '../../application/use-cases/interoperability/get-dhis2-config.use-case';
import { UpdateDhis2ConfigUseCase } from '../../application/use-cases/interoperability/update-dhis2-config.use-case';
import { GetDhis2SyncHistoryUseCase } from '../../application/use-cases/interoperability/get-dhis2-sync-history.use-case';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';
import { prisma } from '../../infrastructure/database/prisma.client';

const router = Router();

// Both routes below export/sync full patient-level or aggregate clinical
// data to external systems — previously only wrapped in authMiddleware, so
// any authenticated staff member (RECEPTIONIST, CASHIER, ...) could pull a
// full FHIR patient export despite the doc comments below claiming
// Admin-only access.
const ADMIN_ONLY = requireRole(['SUPER_ADMIN', 'ADMIN']);

// Generic handler for the single-resource-read FHIR routes below — they all
// share the same shape (fetch by id scoped to tenant, 404 on not-found, 500
// otherwise), so this avoids repeating the same try/catch six times.
function fhirReadHandler(
  execute: (id: string, tenantId: string) => Promise<any>,
  notFoundMessage: string,
  resourceLabel: string
) {
  return async (req: Request, res: Response) => {
    try {
      const resource = await execute(req.params.id, req.user!.tenantId);
      res.json(resource);
    } catch (error: any) {
      if (error.message === notFoundMessage) {
        res.status(404).json({ error: notFoundMessage });
      } else {
        res.status(500).json({ error: `Failed to retrieve FHIR ${resourceLabel} resource` });
      }
    }
  };
}

/**
 * @route GET /api/interoperability/fhir/metadata
 * @desc FHIR CapabilityStatement — the honest, load-bearing declaration of
 *       exactly what this server supports. Every resource/interaction
 *       listed here must be backed by a real route below; nothing
 *       aspirational belongs in this object.
 * @access Private (Admin)
 */
router.get('/fhir/metadata', authMiddleware, ADMIN_ONLY, (_req: Request, res: Response) => {
  const readOnly = { interaction: [{ code: 'read' }] };
  res.json({
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    kind: 'instance',
    fhirVersion: '4.0.1',
    format: ['json'],
    rest: [
      {
        mode: 'server',
        resource: [
          { type: 'Patient', ...readOnly },
          { type: 'Encounter', ...readOnly },
          { type: 'Condition', ...readOnly },
          { type: 'Observation', ...readOnly },
          { type: 'MedicationRequest', ...readOnly },
          { type: 'DiagnosticReport', ...readOnly }
        ],
        operation: [
          {
            name: 'everything',
            definition: 'http://hl7.org/fhir/OperationDefinition/Patient-everything'
          }
        ]
      }
    ]
  });
});

/**
 * @route GET /api/interoperability/fhir/Patient/:id
 * @desc Get Patient resource in FHIR R4 format
 * @access Private (Admin)
 */
router.get('/fhir/Patient/:id', authMiddleware, ADMIN_ONLY,
  fhirReadHandler((id, tenantId) => new GetFhirPatientUseCase(prisma).execute(id, tenantId), 'Patient not found', 'Patient'));

/**
 * @route GET /api/interoperability/fhir/Patient/:id/$everything
 * @desc Full FHIR Bundle for a patient — every Encounter, Condition,
 *       Observation, MedicationRequest, and DiagnosticReport, composed from
 *       the same mappers backing the single-resource routes below.
 * @access Private (Admin)
 */
router.get('/fhir/Patient/:id/$everything', authMiddleware, ADMIN_ONLY,
  fhirReadHandler((id, tenantId) => new GetFhirPatientEverythingUseCase(prisma).execute(id, tenantId), 'Patient not found', 'Patient $everything Bundle'));

/**
 * @route GET /api/interoperability/fhir/Encounter/:id
 * @access Private (Admin)
 */
router.get('/fhir/Encounter/:id', authMiddleware, ADMIN_ONLY,
  fhirReadHandler((id, tenantId) => new GetFhirEncounterUseCase(prisma).execute(id, tenantId), 'Consultation not found', 'Encounter'));

/**
 * @route GET /api/interoperability/fhir/Condition/:id
 * @access Private (Admin)
 */
router.get('/fhir/Condition/:id', authMiddleware, ADMIN_ONLY,
  fhirReadHandler((id, tenantId) => new GetFhirConditionUseCase(prisma).execute(id, tenantId), 'Diagnosis record not found', 'Condition'));

/**
 * @route GET /api/interoperability/fhir/Observation/:id
 * @desc :id is either a real LabResultValue id, or a synthetic
 *       `vitals-<consultationId>-<loincCode>` id for a vital-sign
 *       Observation (vitals are scalar Consultation columns, not rows).
 * @access Private (Admin)
 */
router.get('/fhir/Observation/:id', authMiddleware, ADMIN_ONLY,
  fhirReadHandler((id, tenantId) => new GetFhirObservationUseCase(prisma).execute(id, tenantId), 'Observation not found', 'Observation'));

/**
 * @route GET /api/interoperability/fhir/MedicationRequest/:id
 * @access Private (Admin)
 */
router.get('/fhir/MedicationRequest/:id', authMiddleware, ADMIN_ONLY,
  fhirReadHandler((id, tenantId) => new GetFhirMedicationRequestUseCase(prisma).execute(id, tenantId), 'Prescription not found', 'MedicationRequest'));

/**
 * @route GET /api/interoperability/fhir/DiagnosticReport/:id
 * @access Private (Admin)
 */
router.get('/fhir/DiagnosticReport/:id', authMiddleware, ADMIN_ONLY,
  fhirReadHandler((id, tenantId) => new GetFhirDiagnosticReportUseCase(prisma).execute(id, tenantId), 'Lab test record not found', 'DiagnosticReport'));

/**
 * @route POST /api/interoperability/dhis2/sync
 * @desc Trigger DHIS2 aggregate sync for a given month and year
 * @access Private (Admin)
 */
router.post('/dhis2/sync', authMiddleware, ADMIN_ONLY, async (req: Request, res: Response) => {
  try {
    // Basic validation
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    const useCase = new SyncDhis2AggregateUseCase(prisma);
    const result = await useCase.execute(req.user!.tenantId, parseInt(month), parseInt(year), req.user!.id);
    res.json(result);
  } catch (error: any) {
    console.error('DHIS2 sync error:', error);
    res.status(500).json({ error: getSafeErrorMessage(error, 'Failed to sync with DHIS2') });
  }
});

/**
 * @route GET /api/interoperability/dhis2/config
 * @desc Get this tenant's DHIS2 integration settings — never returns the
 *       raw password, only whether one is set.
 * @access Private (Admin)
 */
router.get('/dhis2/config', authMiddleware, ADMIN_ONLY, async (req: Request, res: Response) => {
  try {
    const config = await new GetDhis2ConfigUseCase(prisma).execute(req.user!.tenantId);
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: getSafeErrorMessage(error, 'Failed to fetch DHIS2 configuration') });
  }
});

/**
 * @route PUT /api/interoperability/dhis2/config
 * @desc Update this tenant's DHIS2 integration settings. A blank/omitted
 *       password keeps the existing (encrypted) one — it does not clear it.
 * @access Private (Admin)
 */
router.put('/dhis2/config', authMiddleware, ADMIN_ONLY, async (req: Request, res: Response) => {
  try {
    const config = await new UpdateDhis2ConfigUseCase(prisma).execute(req.user!.tenantId, req.body);
    res.json(config);
  } catch (error: any) {
    res.status(400).json({ error: getSafeErrorMessage(error, 'Failed to update DHIS2 configuration') });
  }
});

/**
 * @route GET /api/interoperability/dhis2/history
 * @desc Past DHIS2 push attempts for this tenant, most recent first.
 * @access Private (Admin)
 */
router.get('/dhis2/history', authMiddleware, ADMIN_ONLY, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const history = await new GetDhis2SyncHistoryUseCase(prisma).execute(req.user!.tenantId, limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: getSafeErrorMessage(error, 'Failed to fetch DHIS2 sync history') });
  }
});

export default router;
