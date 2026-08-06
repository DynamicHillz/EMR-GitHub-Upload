/**
 * Pharmacy Controller
 *
 * Handles HTTP requests for pharmacy management
 */

import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { GetPrescriptionQueueUseCase } from '../../application/use-cases/pharmacy/get-prescription-queue.use-case';
import { DispenseMedicationUseCase } from '../../application/use-cases/pharmacy/dispense-medication.use-case';
import { GetMedicationBatchesUseCase } from '../../application/use-cases/pharmacy/get-medication-batches.use-case';
import { AddMedicationBatchUseCase } from '../../application/use-cases/pharmacy/add-medication-batch.use-case';
import { GetInventoryUseCase } from '../../application/use-cases/pharmacy/get-inventory.use-case';
import { GenerateStockAlertsUseCase } from '../../application/use-cases/pharmacy/generate-stock-alerts.use-case';
import { GetStockAlertsUseCase } from '../../application/use-cases/pharmacy/get-stock-alerts.use-case';
import { CheckDrugInteractionsUseCase } from '../../application/use-cases/pharmacy/check-drug-interactions.use-case';
import { GenerateMedicationLabelUseCase } from '../../application/use-cases/pharmacy/generate-medication-label.use-case';
import { GetMedicationsUseCase } from '../../application/use-cases/pharmacy/get-medications.use-case';
import { AddMedicationUseCase } from '../../application/use-cases/pharmacy/add-medication.use-case';
import { UpdateMedicationUseCase } from '../../application/use-cases/pharmacy/update-medication.use-case';
import { GetConsumablesUseCase } from '../../application/use-cases/pharmacy/get-consumables.use-case';
import { AddConsumableUseCase } from '../../application/use-cases/pharmacy/add-consumable.use-case';
import { UpdateConsumableUseCase } from '../../application/use-cases/pharmacy/update-consumable.use-case';
import { AddConsumableBatchUseCase } from '../../application/use-cases/pharmacy/add-consumable-batch.use-case';
import { GetConsumableInventoryUseCase } from '../../application/use-cases/pharmacy/get-consumable-inventory.use-case';
import { RecordConsumableUsageUseCase } from '../../application/use-cases/pharmacy/record-consumable-usage.use-case';
import { GetConsumableUsageUseCase } from '../../application/use-cases/pharmacy/get-consumable-usage.use-case';
import { prisma } from '../../infrastructure/database/prisma.client';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

// Initialize use cases
const getPrescriptionQueueUseCase = new GetPrescriptionQueueUseCase(prisma);
const dispenseMedicationUseCase = new DispenseMedicationUseCase(prisma);
const getMedicationBatchesUseCase = new GetMedicationBatchesUseCase(prisma);
const addMedicationBatchUseCase = new AddMedicationBatchUseCase(prisma);
const getInventoryUseCase = new GetInventoryUseCase(prisma);
const generateStockAlertsUseCase = new GenerateStockAlertsUseCase(prisma);
const getStockAlertsUseCase = new GetStockAlertsUseCase(prisma);
const checkDrugInteractionsUseCase = new CheckDrugInteractionsUseCase(prisma);
const generateMedicationLabelUseCase = new GenerateMedicationLabelUseCase(prisma);
const getMedicationsUseCase = new GetMedicationsUseCase(prisma);
const addMedicationUseCase = new AddMedicationUseCase(prisma);
const updateMedicationUseCase = new UpdateMedicationUseCase(prisma);
const getConsumablesUseCase = new GetConsumablesUseCase(prisma);
const addConsumableUseCase = new AddConsumableUseCase(prisma);
const updateConsumableUseCase = new UpdateConsumableUseCase(prisma);
const addConsumableBatchUseCase = new AddConsumableBatchUseCase(prisma);
const getConsumableInventoryUseCase = new GetConsumableInventoryUseCase(prisma);
const recordConsumableUsageUseCase = new RecordConsumableUsageUseCase(prisma);
const getConsumableUsageUseCase = new GetConsumableUsageUseCase(prisma);

/**
 * GET /api/pharmacy/prescriptions
 * Get prescription queue (REQ-PHARM-1)
 */
export const getPrescriptionQueue = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const filters = {
      status: req.query.status as any,
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      patientId: req.query.patientId as string,
      billingStatus: req.query.billingStatus as any,
    };

    const queue = await getPrescriptionQueueUseCase.execute(filters, tenantId);

    // Clinical narrative (a slice of the consultation note) has no reason
    // to reach CASHIER — they're viewing this queue for billing/dispensing
    // logistics, not clinical context.
    const responseData = req.user?.role === 'CASHIER'
      ? queue.map(({ clinicalIndication, ...rest }) => rest)
      : queue;

    return res.status(200).json({
      success: true,
      message: 'Prescription queue retrieved successfully',
      data: responseData,
    });
  } catch (error: any) {
    logger.error('Error fetching prescription queue:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch prescription queue',
    });
  }
};

/**
 * POST /api/pharmacy/dispense
 * Dispense medication (REQ-PHARM-2, REQ-PHARM-3, REQ-PHARM-7)
 */
export const dispenseMedication = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID or user ID found',
      });
    }

    const dispensingData = {
      prescriptionId: req.body.prescriptionId,
      batchId: req.body.batchId,
      quantityDispensed: req.body.quantityDispensed,
      pharmacistNotes: req.body.pharmacistNotes,
    };

    const result = await dispenseMedicationUseCase.execute(
      dispensingData,
      userId,
      tenantId
    );

    return res.status(201).json({
      success: true,
      message: 'Medication dispensed successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Error dispensing medication:', error);

    // Handle allergy blocking
    if (error.message.includes('ALLERGY WARNING')) {
      return res.status(403).json({
        success: false,
        message: error.message,
        error: 'Allergy check failed',
      });
    }

    // Handle other errors
    if (
      error.message.includes('not found') ||
      error.message.includes('expired') ||
      error.message.includes('Insufficient stock')
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to dispense medication',
    });
  }
};

/**
 * GET /api/pharmacy/batches
 * Get available medication batches for a given medication
 */
export const getMedicationBatches = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const medicationName = req.query.medicationName as string;

    if (!medicationName) {
      return res.status(400).json({
        success: false,
        message: 'medicationName query parameter is required',
      });
    }

    const batches = await getMedicationBatchesUseCase.execute(
      { medicationName },
      tenantId
    );

    return res.status(200).json({
      success: true,
      message: 'Medication batches retrieved successfully',
      data: batches,
    });
  } catch (error: any) {
    logger.error('Error fetching medication batches:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch medication batches',
    });
  }
};

/**
 * POST /api/pharmacy/inventory/batches
 * Add new medication batch (REQ-PHARM-4)
 */
export const addMedicationBatch = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const batchData = {
      medicationId: req.body.medicationId,
      batchNumber: req.body.batchNumber,
      expiryDate: new Date(req.body.expiryDate),
      quantity: req.body.quantity,
      unitCost: req.body.unitCost,
      sellingPrice: req.body.sellingPrice,
      supplier: req.body.supplier,
      purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : undefined,
    };

    const result = await addMedicationBatchUseCase.execute(batchData, tenantId);

    return res.status(201).json({
      success: true,
      message: 'Medication batch added successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Error adding medication batch:', error);

    if (error.message.includes('not found') || error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to add medication batch',
    });
  }
};

/**
 * GET /api/pharmacy/inventory
 * Get complete inventory (REQ-PHARM-4)
 */
export const getInventory = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const inventory = await getInventoryUseCase.execute(tenantId);

    return res.status(200).json({
      success: true,
      message: 'Inventory retrieved successfully',
      data: inventory,
    });
  } catch (error: any) {
    logger.error('Error fetching inventory:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory',
    });
  }
};

/**
 * POST /api/pharmacy/alerts/generate
 * Generate stock alerts (REQ-PHARM-5)
 */
export const generateStockAlerts = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const alerts = await generateStockAlertsUseCase.execute(tenantId);

    return res.status(200).json({
      success: true,
      message: `Generated ${alerts.length} new alert(s)`,
      data: alerts,
    });
  } catch (error: any) {
    logger.error('Error generating stock alerts:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to generate stock alerts',
    });
  }
};

/**
 * GET /api/pharmacy/alerts
 * Get stock alerts (REQ-PHARM-5)
 */
export const getStockAlerts = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const filters = {
      status: req.query.status as any,
      severity: req.query.severity as any,
      alertType: req.query.alertType as any,
    };

    const alerts = await getStockAlertsUseCase.execute(filters, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Stock alerts retrieved successfully',
      data: alerts,
    });
  } catch (error: any) {
    logger.error('Error fetching stock alerts:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stock alerts',
    });
  }
};

/**
 * POST /api/pharmacy/interactions/check
 * Check drug interactions (REQ-PHARM-6)
 */
export const checkDrugInteractions = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const checkData = {
      patientId: req.body.patientId,
      medicationName: req.body.medicationName,
    };

    const result = await checkDrugInteractionsUseCase.execute(checkData, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Drug interaction check completed',
      data: result,
    });
  } catch (error: any) {
    logger.error('Error checking drug interactions:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to check drug interactions',
    });
  }
};

/**
 * POST /api/pharmacy/labels/generate
 * Generate medication label (REQ-PHARM-8)
 */
export const generateMedicationLabel = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const labelData = await generateMedicationLabelUseCase.execute(
      { dispensingRecordId: req.body.dispensingRecordId },
      tenantId
    );

    return res.status(200).json({
      success: true,
      message: 'Medication label generated successfully',
      data: labelData,
    });
  } catch (error: any) {
    logger.error('Error generating medication label:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to generate medication label',
    });
  }
};

/**
 * GET /api/pharmacy/medications
 * Get list of all medications
 */
export const getMedications = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const medications = await getMedicationsUseCase.execute(tenantId);

    return res.status(200).json({
      success: true,
      message: 'Medications retrieved successfully',
      data: medications,
    });
  } catch (error: any) {
    logger.error('Error fetching medications:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch medications',
    });
  }
};

/**
 * POST /api/pharmacy/medications
 * Add a new medication
 */
export const addMedication = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const medicationData = {
      name: req.body.name,
      genericName: req.body.genericName,
      brandName: req.body.brandName,
      activeIngredient: req.body.activeIngredient,
      category: req.body.category,
      dosageForm: req.body.dosageForm,
      strength: req.body.strength,
      drugClass: req.body.drugClass,
      reorderPoint: req.body.reorderPoint ? parseInt(req.body.reorderPoint) : undefined,
      stockLevel: req.body.stockLevel !== undefined ? parseInt(req.body.stockLevel) : undefined,
      unitPrice: parseFloat(req.body.unitPrice),
    };

    const medication = await addMedicationUseCase.execute(medicationData, tenantId);

    return res.status(201).json({
      success: true,
      message: 'Medication added successfully',
      data: medication,
    });
  } catch (error: any) {
    logger.error('Error adding medication:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    let errorMessage = getSafeErrorMessage(error, 'An unknown error occurred');

    // Clean up Prisma validation errors to make them human-readable
    if (errorMessage.includes('Invalid `this.prisma')) {
      const lines = errorMessage.split('\n').filter((l: string) => l.trim().length > 0);
      errorMessage = lines[lines.length - 1].trim() || 'Database validation error';
    }

    if (errorMessage.includes('already exists')) {
      return res.status(400).json({
        success: false,
        message: errorMessage,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to add medication',
      error: errorMessage,
    });
  }
};

/**
 * PUT /api/pharmacy/medications/:id
 * Update an existing medication
 */
export const updateMedication = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Medication ID is required',
      });
    }

    if (!req.body.name || !req.body.unitPrice) {
      return res.status(400).json({
        success: false,
        message: 'Medication name and unit price are required',
      });
    }

    const medicationData = {
      name: req.body.name,
      genericName: req.body.genericName,
      brandName: req.body.brandName,
      activeIngredient: req.body.activeIngredient,
      category: req.body.category,
      dosageForm: req.body.dosageForm,
      strength: req.body.strength,
      drugClass: req.body.drugClass,
      reorderPoint: req.body.reorderPoint ? parseInt(req.body.reorderPoint) : undefined,
      stockLevel: req.body.stockLevel !== undefined ? parseInt(req.body.stockLevel) : undefined,
      unitPrice: parseFloat(req.body.unitPrice),
    };

    const medication = await updateMedicationUseCase.execute(id, tenantId, medicationData);

    return res.status(200).json({
      success: true,
      message: 'Medication updated successfully',
      data: medication,
    });
  } catch (error: any) {
    logger.error('Error updating medication:', error);

    let errorMessage = getSafeErrorMessage(error, 'An unknown error occurred');

    if (errorMessage.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: errorMessage,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update medication',
    });
  }
};

export const getInventoryCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const categories = await prisma.inventoryCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: categories });
  } catch (error: any) {
    logger.error('Error fetching inventory categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
};

export const createInventoryCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, description } = req.body;
    
    const existing = await prisma.inventoryCategory.findFirst({
      where: { tenantId, name }
    });
    
    if (existing) {
      res.status(400).json({ success: false, message: 'Category already exists' });
      return;
    }
    
    const category = await prisma.inventoryCategory.create({
      data: { tenantId, name, description }
    });
    
    res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    logger.error('Error creating inventory category:', error);
    res.status(500).json({ success: false, message: 'Failed to create category' });
  }
};

export const updateInventoryCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const { name, description } = req.body;
    
    const existing = await prisma.inventoryCategory.findFirst({
      where: { tenantId, id }
    });
    
    if (!existing) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }
    
    const category = await prisma.inventoryCategory.update({
      where: { id },
      data: { name, description }
    });
    
    res.status(200).json({ success: true, data: category });
  } catch (error: any) {
    logger.error('Error updating inventory category:', error);
    res.status(500).json({ success: false, message: 'Failed to update category' });
  }
};

export const deleteInventoryCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    
    const existing = await prisma.inventoryCategory.findFirst({
      where: { tenantId, id }
    });
    
    if (!existing) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }
    
    const inUse = await prisma.medication.findFirst({
      where: { tenantId, category: existing.name }
    });
    
    if (inUse) {
      res.status(400).json({ success: false, message: 'Cannot delete category that is currently in use by an inventory item' });
      return;
    }
    
    await prisma.inventoryCategory.delete({
      where: { id }
    });
    
    res.status(204).send();
  } catch (error: any) {
    logger.error('Error deleting inventory category:', error);
    res.status(500).json({ success: false, message: 'Failed to delete category' });
  }
};

// ==================== CONSUMABLES ====================

/**
 * GET /api/pharmacy/consumables
 * Get consumables catalog
 */
export const getConsumables = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const consumables = await getConsumablesUseCase.execute(tenantId);

    return res.status(200).json({
      success: true,
      message: 'Consumables retrieved successfully',
      data: consumables,
    });
  } catch (error: any) {
    logger.error('Error fetching consumables:', error);

    return res.status(500).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to fetch consumables'),
    });
  }
};

/**
 * POST /api/pharmacy/consumables
 * Add a new consumable
 */
export const addConsumable = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const consumableData = {
      name: req.body.name,
      category: req.body.category,
      unit: req.body.unit,
      description: req.body.description,
      reorderPoint: req.body.reorderPoint ? parseInt(req.body.reorderPoint) : undefined,
      stockLevel: req.body.stockLevel !== undefined ? parseInt(req.body.stockLevel) : undefined,
      unitPrice: parseFloat(req.body.unitPrice),
    };

    const consumable = await addConsumableUseCase.execute(consumableData, tenantId);

    return res.status(201).json({
      success: true,
      message: 'Consumable added successfully',
      data: consumable,
    });
  } catch (error: any) {
    logger.error('Error adding consumable:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to add consumable'),
    });
  }
};

/**
 * PUT /api/pharmacy/consumables/:id
 * Update an existing consumable
 */
export const updateConsumable = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    if (!req.body.name || req.body.unitPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Consumable name and unit price are required',
      });
    }

    const consumableData = {
      name: req.body.name,
      category: req.body.category,
      unit: req.body.unit,
      description: req.body.description,
      reorderPoint: req.body.reorderPoint !== undefined ? parseInt(req.body.reorderPoint) : undefined,
      stockLevel: req.body.stockLevel !== undefined ? parseInt(req.body.stockLevel) : undefined,
      unitPrice: parseFloat(req.body.unitPrice),
    };

    const consumable = await updateConsumableUseCase.execute(id, tenantId, consumableData);

    return res.status(200).json({
      success: true,
      message: 'Consumable updated successfully',
      data: consumable,
    });
  } catch (error: any) {
    logger.error('Error updating consumable:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to update consumable'),
    });
  }
};

/**
 * GET /api/pharmacy/consumables/inventory
 * Get consumables inventory (stock levels + batches)
 */
export const getConsumableInventory = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const inventory = await getConsumableInventoryUseCase.execute(tenantId);

    return res.status(200).json({
      success: true,
      message: 'Consumable inventory retrieved successfully',
      data: inventory,
    });
  } catch (error: any) {
    logger.error('Error fetching consumable inventory:', error);

    return res.status(500).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to fetch consumable inventory'),
    });
  }
};

/**
 * POST /api/pharmacy/consumables/batches
 * Add a new consumable batch (stock)
 */
export const addConsumableBatch = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const batchData = {
      consumableId: req.body.consumableId,
      batchNumber: req.body.batchNumber,
      expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
      quantity: req.body.quantity,
      unitCost: req.body.unitCost,
      sellingPrice: req.body.sellingPrice,
      supplier: req.body.supplier,
      purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : undefined,
    };

    const result = await addConsumableBatchUseCase.execute(batchData, tenantId);

    return res.status(201).json({
      success: true,
      message: 'Consumable batch added successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Error adding consumable batch:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to add consumable batch'),
    });
  }
};

/**
 * GET /api/pharmacy/consumables/usage
 * List consumable usage records (filter by patientId / billingStatus)
 */
export const getConsumableUsage = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const records = await getConsumableUsageUseCase.execute(tenantId, {
      patientId: req.query.patientId as string | undefined,
      billingStatus: req.query.billingStatus as 'UNBILLED' | 'BILLED' | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    });

    return res.status(200).json({
      success: true,
      message: 'Consumable usage retrieved successfully',
      data: records,
    });
  } catch (error: any) {
    logger.error('Error fetching consumable usage:', error);

    return res.status(500).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to fetch consumable usage'),
    });
  }
};

/**
 * POST /api/pharmacy/consumables/usage
 * Record that a consumable was used on a patient (deducts stock, creates
 * an unbilled charge) — single step, Pharmacist or Nurse.
 */
export const recordConsumableUsage = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const recordedById = req.user?.id;

    if (!tenantId || !recordedById) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const usageData = {
      patientId: req.body.patientId,
      consumableId: req.body.consumableId,
      batchId: req.body.batchId,
      quantityUsed: parseInt(req.body.quantityUsed),
      admissionId: req.body.admissionId || undefined,
      consultationId: req.body.consultationId || undefined,
      notes: req.body.notes,
      flowRateLpm: req.body.flowRateLpm !== undefined ? parseFloat(req.body.flowRateLpm) : undefined,
      deliveryMethod: req.body.deliveryMethod || undefined,
      spO2Before: req.body.spO2Before !== undefined ? parseInt(req.body.spO2Before) : undefined,
      spO2After: req.body.spO2After !== undefined ? parseInt(req.body.spO2After) : undefined,
    };

    const result = await recordConsumableUsageUseCase.execute(usageData, recordedById, tenantId);

    return res.status(201).json({
      success: true,
      message: 'Consumable usage recorded successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Error recording consumable usage:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(400).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to record consumable usage'),
    });
  }
};
