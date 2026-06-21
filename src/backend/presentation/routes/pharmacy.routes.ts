/**
 * Pharmacy Routes
 * Role-based access control applied per permission matrix
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';
import {
  getPrescriptionQueue,
  dispenseMedication,
  getMedicationBatches,
  addMedicationBatch,
  getInventory,
  generateStockAlerts,
  getStockAlerts,
  checkDrugInteractions,
  generateMedicationLabel,
  getMedications,
  addMedication,
} from '../controllers/pharmacy.controller';

const router = Router();

// View pharmacy data: ADMIN, DOCTOR, NURSE, PHARMACIST
const CAN_VIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST']);

// Dispense medications: ADMIN, PHARMACIST only
const CAN_DISPENSE = requireRole(['SUPER_ADMIN', 'ADMIN', 'PHARMACIST']);

// Manage inventory: ADMIN, PHARMACIST only
const CAN_MANAGE_INVENTORY = requireRole(['SUPER_ADMIN', 'ADMIN', 'PHARMACIST']);

router.get('/prescriptions', CAN_VIEW, asyncHandler(getPrescriptionQueue));
router.get('/medications', CAN_VIEW, asyncHandler(getMedications));
router.get('/batches', CAN_VIEW, asyncHandler(getMedicationBatches));
router.get('/inventory', CAN_VIEW, asyncHandler(getInventory));
router.get('/alerts', CAN_VIEW, asyncHandler(getStockAlerts));

router.post('/medications', CAN_MANAGE_INVENTORY, asyncHandler(addMedication));
router.post('/inventory/batches', CAN_MANAGE_INVENTORY, asyncHandler(addMedicationBatch));
router.post('/alerts/generate', CAN_MANAGE_INVENTORY, asyncHandler(generateStockAlerts));
router.post('/dispense', CAN_DISPENSE, asyncHandler(dispenseMedication));
router.post('/interactions/check', CAN_VIEW, asyncHandler(checkDrugInteractions));
router.post('/labels/generate', CAN_VIEW, asyncHandler(generateMedicationLabel));

export default router;