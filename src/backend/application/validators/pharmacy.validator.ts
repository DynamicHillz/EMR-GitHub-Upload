/**
 * Pharmacy Validators
 *
 * Joi validation schemas for the pharmacy module — previously had none at
 * all (pharmacy.routes.ts had no validateRequest anywhere). Most of the
 * dangerous cases (negative prices/quantities, out-of-range values) are
 * already caught inline in the use-cases themselves; these schemas close
 * the remaining shape/type gaps at the HTTP boundary. Category is a free
 * string, not a fixed enum, since InventoryCategory is a tenant-managed
 * CRUD list (see categories routes), unlike lab's fixed category set.
 */

import Joi from 'joi';

export const addMedicationSchema = Joi.object<any>({
  name: Joi.string().trim().min(1).max(200).required(),
  genericName: Joi.string().trim().max(200).allow('', null).optional(),
  brandName: Joi.string().trim().max(200).allow('', null).optional(),
  activeIngredient: Joi.string().trim().max(200).allow('', null).optional(),
  category: Joi.string().trim().max(100).allow('', null).optional(),
  dosageForm: Joi.string().trim().min(1).max(100).required(),
  strength: Joi.string().trim().min(1).max(100).required(),
  drugClass: Joi.string().trim().max(100).allow('', null).optional(),
  reorderPoint: Joi.number().integer().min(0).optional(),
  stockLevel: Joi.number().integer().min(0).optional(),
  unitPrice: Joi.number().min(0).required(),
  whoAtcCode: Joi.string().trim().max(50).allow('', null).optional(),
  isEssentialMedicine: Joi.boolean().optional(),
});

export const updateMedicationSchema = Joi.object<any>({
  name: Joi.string().trim().min(1).max(200).required(),
  genericName: Joi.string().trim().max(200).allow('', null).optional(),
  brandName: Joi.string().trim().max(200).allow('', null).optional(),
  activeIngredient: Joi.string().trim().max(200).allow('', null).optional(),
  category: Joi.string().trim().max(100).allow('', null).optional(),
  dosageForm: Joi.string().trim().max(100).allow('', null).optional(),
  strength: Joi.string().trim().max(100).allow('', null).optional(),
  drugClass: Joi.string().trim().max(100).allow('', null).optional(),
  reorderPoint: Joi.number().integer().min(0).optional(),
  unitPrice: Joi.number().min(0).required(),
  whoAtcCode: Joi.string().trim().max(50).allow('', null).optional(),
  isEssentialMedicine: Joi.boolean().optional(),
});

export const createInventoryCategorySchema = Joi.object<any>({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
});

export const updateInventoryCategorySchema = Joi.object<any>({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
});

export const addMedicationBatchSchema = Joi.object<any>({
  medicationId: Joi.string().required(),
  batchNumber: Joi.string().trim().min(1).max(100).required(),
  expiryDate: Joi.date().iso().required(),
  quantity: Joi.number().integer().min(0).required(),
  unitCost: Joi.number().min(0).required(),
  sellingPrice: Joi.number().min(0).required(),
  supplier: Joi.string().trim().max(200).allow('', null).optional(),
  purchaseDate: Joi.date().iso().allow(null).optional(),
});

export const dispenseMedicationSchema = Joi.object<any>({
  prescriptionId: Joi.string().required(),
  batchId: Joi.string().required(),
  quantityDispensed: Joi.number().integer().min(1).required(),
  pharmacistNotes: Joi.string().trim().max(1000).allow('', null).optional(),
});

export const checkDrugInteractionsSchema = Joi.object<any>({
  patientId: Joi.string().required(),
  medicationName: Joi.string().trim().min(1).max(200).required(),
});

export const generateMedicationLabelSchema = Joi.object<any>({
  dispensingRecordId: Joi.string().required(),
});

export const addConsumableSchema = Joi.object<any>({
  name: Joi.string().trim().min(1).max(200).required(),
  category: Joi.string().trim().max(100).allow('', null).optional(),
  unit: Joi.string().trim().max(50).allow('', null).optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  reorderPoint: Joi.number().integer().min(0).optional(),
  stockLevel: Joi.number().integer().min(0).optional(),
  unitPrice: Joi.number().min(0).required(),
});

export const updateConsumableSchema = Joi.object<any>({
  name: Joi.string().trim().min(1).max(200).required(),
  category: Joi.string().trim().max(100).allow('', null).optional(),
  unit: Joi.string().trim().max(50).allow('', null).optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  reorderPoint: Joi.number().integer().min(0).optional(),
  stockLevel: Joi.number().integer().min(0).optional(),
  unitPrice: Joi.number().min(0).required(),
});

export const addConsumableBatchSchema = Joi.object<any>({
  consumableId: Joi.string().required(),
  batchNumber: Joi.string().trim().min(1).max(100).required(),
  expiryDate: Joi.date().iso().allow('', null).optional(),
  quantity: Joi.number().integer().min(0).required(),
  unitCost: Joi.number().min(0).required(),
  sellingPrice: Joi.number().min(0).required(),
  supplier: Joi.string().trim().max(200).allow('', null).optional(),
  purchaseDate: Joi.date().iso().allow('', null).optional(),
});

export const recordConsumableUsageSchema = Joi.object<any>({
  patientId: Joi.string().required(),
  consumableId: Joi.string().required(),
  batchId: Joi.string().required(),
  quantityUsed: Joi.number().integer().min(1).required(),
  admissionId: Joi.string().allow('', null).optional(),
  consultationId: Joi.string().allow('', null).optional(),
  notes: Joi.string().trim().max(1000).allow('', null).optional(),
  flowRateLpm: Joi.number().min(0).optional(),
  deliveryMethod: Joi.string().trim().max(100).allow('', null).optional(),
  spO2Before: Joi.number().min(0).max(100).optional(),
  spO2After: Joi.number().min(0).max(100).optional(),
});
