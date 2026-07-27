import { Router } from 'express';
import { InsuranceController } from '../controllers/insurance.controller';
import { requireRole } from '../middleware/auth';

const router = Router();
const insuranceController = new InsuranceController();

// Insurance Providers
router.get(
  '/providers',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'CASHIER', 'NURSE']),
  insuranceController.getProviders.bind(insuranceController)
);

router.post(
  '/providers',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  insuranceController.createProvider.bind(insuranceController)
);

router.put(
  '/providers/:id',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  insuranceController.updateProvider.bind(insuranceController)
);

// Patient Insurance Policies
router.get(
  '/patients/:patientId',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'CASHIER', 'NURSE']),
  insuranceController.getPatientInsurance.bind(insuranceController)
);

router.post(
  '/patients/:patientId',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'CASHIER']),
  insuranceController.addPatientInsurance.bind(insuranceController)
);

// Insurance Claims
router.get(
  '/claims',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'CASHIER']),
  insuranceController.getClaims.bind(insuranceController)
);

router.patch(
  '/claims/:id',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'CASHIER']),
  insuranceController.updateClaimStatus.bind(insuranceController)
);

export default router;
