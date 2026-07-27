import { Router } from 'express';
import { ExemptionController } from '../controllers/exemption.controller';
import { requireRole } from '../middleware/auth';

const router = Router();
const exemptionController = new ExemptionController();

router.get(
  '/',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'CASHIER']),
  exemptionController.getPolicies.bind(exemptionController)
);

router.post(
  '/',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  exemptionController.createPolicy.bind(exemptionController)
);

router.put(
  '/:id',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  exemptionController.updatePolicy.bind(exemptionController)
);

export default router;
