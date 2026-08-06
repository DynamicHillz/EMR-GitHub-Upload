import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';
import { prisma } from '../../infrastructure/database/prisma.client';
import { SearchDiagnosesUseCase, DiagnosisCodeSystem } from '../../application/use-cases/clinical/search-diagnoses.use-case';

const router = Router();

const searchDiagnosesUseCase = new SearchDiagnosesUseCase(prisma);

// Any authenticated staff can search diagnoses
const CAN_VIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'CASHIER']);

router.get('/diagnoses', CAN_VIEW, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No tenant ID found' });
  }

  const { query } = req.query;

  if (!query) {
    return res.json({ success: true, data: [] });
  }

  const codeSystem: DiagnosisCodeSystem = req.query.codeSystem === 'ICD-10' ? 'ICD-10' : 'ICD-11';

  const results = await searchDiagnosesUseCase.execute(query as string, codeSystem, tenantId);

  res.json({
    success: true,
    data: results,
  });
}));

export default router;
