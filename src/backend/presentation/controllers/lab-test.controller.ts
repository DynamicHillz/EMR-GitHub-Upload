/**
 * Lab Test Controller
 *
 * HTTP request handlers for laboratory management operations
 */

import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { GetLabTestQueueUseCase } from '../../application/use-cases/lab/get-lab-test-queue.use-case';
import { GetLabTestByIdUseCase } from '../../application/use-cases/lab/get-lab-test-by-id.use-case';
import { UpdateLabTestStatusUseCase } from '../../application/use-cases/lab/update-lab-test-status.use-case';
import { SubmitLabResultsUseCase } from '../../application/use-cases/lab/submit-lab-results.use-case';
import { ReviewLabResultsUseCase } from '../../application/use-cases/lab/review-lab-results.use-case';
import { UpdateSpecimenDetailsUseCase } from '../../application/use-cases/lab/update-specimen-details.use-case';
import { OrderLabTestUseCase } from '../../application/use-cases/consultation/order-lab-test.use-case';
import { GetLabDictionaryUseCase } from '../../application/use-cases/lab/get-lab-dictionary.use-case';
import { CreateLabDictionaryItemUseCase } from '../../application/use-cases/lab/create-lab-dictionary-item.use-case';
import { UpdateLabDictionaryItemUseCase } from '../../application/use-cases/lab/update-lab-dictionary-item.use-case';
import { PatientRepository } from '../../infrastructure/database/repositories/patient.repository';
import { prisma } from '../../infrastructure/database/prisma.client';

// Initialize repositories
const patientRepository = new PatientRepository(prisma);

// Initialize use cases
const getLabTestQueueUseCase = new GetLabTestQueueUseCase(prisma);
const getLabTestByIdUseCase = new GetLabTestByIdUseCase(prisma);
const updateLabTestStatusUseCase = new UpdateLabTestStatusUseCase(prisma);
const submitLabResultsUseCase = new SubmitLabResultsUseCase(prisma);
const reviewLabResultsUseCase = new ReviewLabResultsUseCase(prisma);
const updateSpecimenDetailsUseCase = new UpdateSpecimenDetailsUseCase(prisma);
const orderLabTestUseCase = new OrderLabTestUseCase(prisma, patientRepository);
const getLabDictionaryUseCase = new GetLabDictionaryUseCase(prisma);
const createLabDictionaryItemUseCase = new CreateLabDictionaryItemUseCase(prisma);
const updateLabDictionaryItemUseCase = new UpdateLabDictionaryItemUseCase(prisma);

/**
 * GET /api/lab-tests
 * Get lab test queue
 * REQ-LAB-1: Display pending lab test requests sorted by urgency
 */
export const getLabTestQueue = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { status, urgency, limit, offset, patientId, billingStatus } = req.query;

    const filters: any = {};

    if (status) {
      filters.status = status;
    }

    if (urgency) {
      filters.urgency = urgency;
    }

    if (limit) {
      filters.limit = parseInt(limit as string);
    }

    if (offset) {
      filters.skip = parseInt(offset as string);
    }

    if (patientId) {
      filters.patientId = patientId as string;
    }

    if (billingStatus) {
      filters.billingStatus = billingStatus as any;
    }

    const labTests = await getLabTestQueueUseCase.execute(tenantId, filters);

    return res.status(200).json({
      success: true,
      data: labTests,
      total: labTests.length,
    });
  } catch (error: any) {
    logger.error('Error getting lab test queue:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to get lab test queue',
    });
  }
};

/**
 * GET /api/lab-tests/dictionary
 * Get lab dictionary with dynamic parameters and reference ranges
 */
export const getLabDictionary = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { testCode } = req.query;

    const dictionary = await getLabDictionaryUseCase.execute(tenantId, testCode as string);
    logger.info(`getLabDictionary returning ${Array.isArray(dictionary) ? dictionary.length : 1} tests`);

    return res.status(200).json({
      success: true,
      data: dictionary,
    });
  } catch (error: any) {
    logger.error('Error getting lab dictionary:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to get lab dictionary',
    });
  }
};

/**
 * POST /api/lab/dictionary
 * Create a new lab test dictionary item
 */
export const createLabDictionaryItem = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const test = await createLabDictionaryItemUseCase.execute(tenantId, req.body);

    return res.status(201).json({
      success: true,
      message: 'Lab test created successfully',
      data: test,
    });
  } catch (error: any) {
    logger.error('Error creating lab dictionary item:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create lab test',
    });
  }
};

/**
 * PUT /api/lab/dictionary/:id
 * Update an existing lab test dictionary item
 */
export const updateLabDictionaryItem = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const test = await updateLabDictionaryItemUseCase.execute(tenantId, id, req.body);

    return res.status(200).json({
      success: true,
      message: 'Lab test updated successfully',
      data: test,
    });
  } catch (error: any) {
    logger.error('Error updating lab dictionary item:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update lab test',
    });
  }
};

/**
 * GET /api/lab-tests/:id
 * Get lab test by ID
 */
export const getLabTestById = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { id } = req.params;

    const labTest = await getLabTestByIdUseCase.execute(id, tenantId);

    return res.status(200).json({
      success: true,
      data: labTest,
    });
  } catch (error: any) {
    logger.error('Error getting lab test:', error);

    if (error.message === 'Lab test not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to get lab test',
    });
  }
};

/**
 * PUT /api/lab-tests/:id/status
 * Update lab test status
 * REQ-LAB-2: Allow lab technicians to update test status
 */
export const updateLabTestStatus = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { id } = req.params;

    await updateLabTestStatusUseCase.execute(id, req.body, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Lab test status updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating lab test status:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('Invalid status transition')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update lab test status',
    });
  }
};

/**
 * PUT /api/lab-tests/:id/results
 * Submit lab test results
 * REQ-LAB-3: Structured result entry with reference ranges
 * REQ-LAB-4: Auto-flag abnormal results
 */
export const submitLabResults = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { id } = req.params;

    await submitLabResultsUseCase.execute(id, req.body, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Lab results submitted successfully',
    });
  } catch (error: any) {
    logger.error('Error submitting lab results:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('IN_PROGRESS')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to submit lab results',
    });
  }
};

/**
 * POST /api/lab-tests/:id/review
 * Review lab test results
 * REQ-LAB-5: Require doctor review and approval
 */
export const reviewLabResults = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const doctorId = req.user?.id;

    if (!tenantId || !doctorId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID or doctor ID found',
      });
    }

    const { id } = req.params;

    await reviewLabResultsUseCase.execute(id, req.body, doctorId, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Lab results reviewed successfully',
    });
  } catch (error: any) {
    logger.error('Error reviewing lab results:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.message.includes('COMPLETED') ||
      error.message.includes('without results')
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to review lab results',
    });
  }
};

/**
 * PUT /api/lab-tests/:id/specimen
 * Update specimen details
 * REQ-LAB-7: Track specimen collection, quality, and rejection
 */
export const updateSpecimenDetails = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { id } = req.params;

    await updateSpecimenDetailsUseCase.execute(id, req.body, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Specimen details updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating specimen details:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.message.includes('reviewed') ||
      error.message.includes('Rejection reason is required')
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update specimen details',
    });
  }
};

/**
 * POST /api/lab/tests
 * Create a new lab test order
 * Allows ordering lab tests directly from lab module (standalone orders)
 */
export const createLabTest = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID or user ID found',
      });
    }

    const labTestData = {
      ...req.body,
      consultationId: null, // Standalone order, not linked to consultation
    };

    const labTest = await orderLabTestUseCase.execute(
      labTestData,
      userId,
      tenantId
    );

    return res.status(201).json({
      success: true,
      message: 'Lab test order created successfully',
      data: labTest,
    });
  } catch (error: any) {
    logger.error('Error creating lab test:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create lab test order',
    });
  }
};
