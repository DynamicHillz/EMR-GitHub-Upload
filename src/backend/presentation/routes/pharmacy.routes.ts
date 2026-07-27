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
  updateMedication,
  getInventoryCategories,
  createInventoryCategory,
  updateInventoryCategory,
  deleteInventoryCategory,
  getConsumables,
  addConsumable,
  updateConsumable,
  getConsumableInventory,
  addConsumableBatch,
  getConsumableUsage,
  recordConsumableUsage
} from '../controllers/pharmacy.controller';

const router = Router();

// View pharmacy data: ADMIN, DOCTOR, NURSE, PHARMACIST, CASHIER
const CAN_VIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST', 'CASHIER']);

// Dispense medications: PHARMACIST only
const CAN_DISPENSE = requireRole(['PHARMACIST']);

// Manage inventory: ADMIN, PHARMACIST only
const CAN_MANAGE_INVENTORY = requireRole(['SUPER_ADMIN', 'ADMIN', 'PHARMACIST']);

// Record consumable usage: PHARMACIST or NURSE — consumables (gloves,
// syringes, gauze) are often used directly by a nurse during a procedure,
// not issued from the pharmacy counter like medications.
// DOCTOR included alongside PHARMACIST/NURSE — in an emergency (e.g. giving
// oxygen), whichever clinician is physically present should be able to log
// it immediately rather than needing a nurse/pharmacist to do it for them.
const CAN_RECORD_CONSUMABLE_USAGE = requireRole(['PHARMACIST', 'NURSE', 'DOCTOR']);

router.get('/prescriptions', CAN_VIEW, asyncHandler(getPrescriptionQueue));
router.get('/medications', CAN_VIEW, asyncHandler(getMedications));
router.get('/batches', CAN_VIEW, asyncHandler(getMedicationBatches));
router.get('/inventory', CAN_VIEW, asyncHandler(getInventory));
router.get('/alerts', CAN_VIEW, asyncHandler(getStockAlerts));

router.post('/medications', requireRole(['SUPER_ADMIN', 'ADMIN', 'PHARMACIST']), asyncHandler(addMedication));
router.put('/medications/:id', requireRole(['SUPER_ADMIN', 'ADMIN', 'PHARMACIST']), asyncHandler(updateMedication));

// Category management (Super Admin / Admin only)
router.get('/categories', requireRole(['SUPER_ADMIN', 'ADMIN', 'PHARMACIST', 'DOCTOR', 'NURSE']), asyncHandler(getInventoryCategories));
router.post('/categories', requireRole(['SUPER_ADMIN', 'ADMIN']), asyncHandler(createInventoryCategory));
router.put('/categories/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), asyncHandler(updateInventoryCategory));
router.delete('/categories/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), asyncHandler(deleteInventoryCategory));

router.post('/inventory/batches', CAN_MANAGE_INVENTORY, asyncHandler(addMedicationBatch));
router.post('/alerts/generate', CAN_MANAGE_INVENTORY, asyncHandler(generateStockAlerts));
router.post('/dispense', CAN_DISPENSE, asyncHandler(dispenseMedication));
router.post('/interactions/check', CAN_VIEW, asyncHandler(checkDrugInteractions));
router.post('/labels/generate', CAN_VIEW, asyncHandler(generateMedicationLabel));

// Consumables (non-drug supplies: syringes, gloves, gauze, cannula, etc.)
router.get('/consumables', CAN_VIEW, asyncHandler(getConsumables));
router.post('/consumables', CAN_MANAGE_INVENTORY, asyncHandler(addConsumable));
router.put('/consumables/:id', CAN_MANAGE_INVENTORY, asyncHandler(updateConsumable));
router.get('/consumables/inventory', CAN_VIEW, asyncHandler(getConsumableInventory));
router.post('/consumables/batches', CAN_MANAGE_INVENTORY, asyncHandler(addConsumableBatch));
router.get('/consumables/usage', CAN_VIEW, asyncHandler(getConsumableUsage));
router.post('/consumables/usage', CAN_RECORD_CONSUMABLE_USAGE, asyncHandler(recordConsumableUsage));

export default router;