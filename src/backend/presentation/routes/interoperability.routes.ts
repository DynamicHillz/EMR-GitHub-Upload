import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, requireRole } from '../middleware/auth';
import { GetFhirPatientUseCase } from '../../application/use-cases/interoperability/get-fhir-patient.use-case';
import { SyncDhis2AggregateUseCase } from '../../application/use-cases/interoperability/sync-dhis2-aggregate.use-case';

const router = Router();
const prisma = new PrismaClient();

// Both routes below export/sync full patient-level or aggregate clinical
// data to external systems — previously only wrapped in authMiddleware, so
// any authenticated staff member (RECEPTIONIST, CASHIER, ...) could pull a
// full FHIR patient export despite the doc comments below claiming
// Admin-only access.
const ADMIN_ONLY = requireRole(['SUPER_ADMIN', 'ADMIN']);

/**
 * @route GET /api/interoperability/fhir/Patient/:id
 * @desc Get Patient resource in FHIR R4 format
 * @access Private (Admin)
 */
router.get('/fhir/Patient/:id', authMiddleware, ADMIN_ONLY, async (req: Request, res: Response) => {
  try {
    const useCase = new GetFhirPatientUseCase(prisma);
    const fhirPatient = await useCase.execute(req.params.id, req.user!.tenantId);
    res.json(fhirPatient);
  } catch (error: any) {
    if (error.message === 'Patient not found') {
      res.status(404).json({ error: 'Patient not found' });
    } else {
      res.status(500).json({ error: 'Failed to retrieve FHIR Patient resource' });
    }
  }
});

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
    const result = await useCase.execute(req.user!.tenantId, parseInt(month), parseInt(year));
    res.json(result);
  } catch (error: any) {
    console.error('DHIS2 sync error:', error);
    res.status(500).json({ error: 'Failed to sync with DHIS2' });
  }
});

export default router;
