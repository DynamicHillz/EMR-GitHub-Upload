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
import { prisma } from '../../infrastructure/database/prisma.client';

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
    };

    const queue = await getPrescriptionQueueUseCase.execute(filters, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Prescription queue retrieved successfully',
      data: queue,
    });
  } catch (error: any) {
    logger.error('Error fetching prescription queue:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch prescription queue',
      error: error.message,
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
      error: error.message,
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
      error: error.message,
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
      error: error.message,
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
      error: error.message,
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
      error: error.message,
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
      error: error.message,
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
      error: error.message,
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
      error: error.message,
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
      error: error.message,
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

    if (error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to add medication',
      error: error.message,
    });
  }
};
