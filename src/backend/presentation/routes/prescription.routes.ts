import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

import { prisma } from '../../infrastructure/database/prisma.client';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/auth';
import { getPrescriptions, createPrescription, checkInteractions } from '../controllers/prescription.controller';

const router = Router();

router.use(authenticate);

// Prescribing is a clinical act — DOCTOR only, matching the same restriction
// already enforced on the consultation-scoped prescription route.
const CAN_PRESCRIBE = requireRole(['DOCTOR']);
const CAN_VIEW_PRESCRIPTIONS = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST']);

router.get('/patient/:patientId', CAN_VIEW_PRESCRIPTIONS, asyncHandler(async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
  const skip = req.query.offset ? parseInt(req.query.offset as string) : undefined;

  const [prescriptions, total] = await Promise.all([
    prisma.prescription.findMany({
      where: { patientId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    }),
    prisma.prescription.count({ where: { patientId, tenantId } }),
  ]);

  res.json({
    message: 'Prescriptions fetched successfully',
    data: prescriptions,
    total,
  });
}));

router.get('/check-interactions', CAN_VIEW_PRESCRIPTIONS, asyncHandler(checkInteractions));

router.get('/', CAN_VIEW_PRESCRIPTIONS, asyncHandler(getPrescriptions));

router.post('/', CAN_PRESCRIBE, asyncHandler(createPrescription));

export default router;
