/**
 * Consultation Controller
 *
 * HTTP request handlers for consultation operations
 */

import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { CreateConsultationUseCase } from '../../application/use-cases/consultation/create-consultation.use-case';
import { UpdateConsultationUseCase } from '../../application/use-cases/consultation/update-consultation.use-case';
import { FinalizeConsultationUseCase } from '../../application/use-cases/consultation/finalize-consultation.use-case';
import { GetConsultationUseCase } from '../../application/use-cases/consultation/get-consultation.use-case';
import { GetPatientConsultationsUseCase } from '../../application/use-cases/consultation/get-patient-consultations.use-case';
import { CreatePrescriptionUseCase } from '../../application/use-cases/consultation/create-prescription.use-case';
import { OrderLabTestUseCase } from '../../application/use-cases/consultation/order-lab-test.use-case';
import { ConsultationRepository } from '../../infrastructure/database/repositories/consultation.repository';
import { PatientRepository } from '../../infrastructure/database/repositories/patient.repository';
import { prisma } from '../../infrastructure/database/prisma.client';

// Initialize repositories
const consultationRepository = new ConsultationRepository(prisma);
const patientRepository = new PatientRepository(prisma);

// Initialize use cases
const createConsultationUseCase = new CreateConsultationUseCase(
  consultationRepository,
  patientRepository
);
const updateConsultationUseCase = new UpdateConsultationUseCase(consultationRepository);
const finalizeConsultationUseCase = new FinalizeConsultationUseCase(consultationRepository);
const getConsultationUseCase = new GetConsultationUseCase(consultationRepository);
const getPatientConsultationsUseCase = new GetPatientConsultationsUseCase(prisma);
const createPrescriptionUseCase = new CreatePrescriptionUseCase(prisma, patientRepository);
const orderLabTestUseCase = new OrderLabTestUseCase(prisma, patientRepository);

/**
 * POST /api/consultations
 * Create a new consultation
 * REQ-CLIN-1: SOAP format documentation
 * REQ-CLIN-2: Vital signs capture
 */
export const createConsultation = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const consultation = await createConsultationUseCase.execute(req.body, tenantId, req.user);

    return res.status(201).json({
      success: true,
      message: 'Consultation created successfully',
      data: consultation,
    });
  } catch (error: any) {
    logger.error('Error creating consultation:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create consultation',
    });
  }
};

/**
 * PUT /api/consultations/:id
 * Update a consultation
 * REQ-CLIN-6: Only DRAFT consultations can be updated
 */
export const updateConsultation = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { id } = req.params;

    const consultation = await updateConsultationUseCase.execute(id, req.body, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Consultation updated successfully',
      data: consultation,
    });
  } catch (error: any) {
    logger.error('Error updating consultation:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('Cannot edit')) {
      return res.status(403).json({
        success: false,
        message: error.message,
        error: 'This consultation has been finalized and cannot be edited',
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to update consultation',
    });
  }
};

/**
 * POST /api/consultations/:id/finalize
 * Finalize a consultation
 * REQ-CLIN-6: Lock consultation to prevent further edits
 */
export const finalizeConsultation = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { id } = req.params;

    const result = await finalizeConsultationUseCase.execute(id, tenantId);

    return res.status(200).json(result);
  } catch (error: any) {
    logger.error('Error finalizing consultation:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.message.includes('required') ||
      error.message.includes('already finalized')
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to finalize consultation',
    });
  }
};

/**
 * GET /api/consultations/:id
 * Get a consultation by ID
 */
export const getConsultationById = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { id } = req.params;

    const consultation = await getConsultationUseCase.execute(id, tenantId);

    return res.status(200).json({
      success: true,
      data: consultation,
    });
  } catch (error: any) {
    logger.error('Error getting consultation:', error);

    if (error.message === 'Consultation not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to get consultation',
    });
  }
};

/**
 * GET /api/consultations/patient/:patientId
 * Get all consultations for a patient
 * REQ-CLIN-8: Patient consultation history
 */
export const getPatientConsultations = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { patientId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const consultations = await getPatientConsultationsUseCase.execute(
      patientId,
      tenantId,
      { limit }
    );

    return res.status(200).json({
      success: true,
      data: consultations,
      total: consultations.length,
    });
  } catch (error: any) {
    logger.error('Error getting patient consultations:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to get patient consultations',
    });
  }
};

/**
 * DELETE /api/consultations/:id
 * Delete a consultation
 */
export const deleteConsultation = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { id } = req.params;
    const userId = req.user?.id;

    await consultationRepository.delete(id, tenantId, userId);

    return res.status(200).json({
      success: true,
      message: 'Consultation deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting consultation:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to delete consultation',
    });
  }
};

/**
 * POST /api/consultations/:id/prescriptions
 * Create prescription from consultation
 * REQ-CLIN-3: E-prescribing
 * REQ-CLIN-7: Allergy checking
 */
export const createPrescription = async (req: Request, res: Response) => {
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

    const prescriptionData = {
      ...req.body,
      consultationId: id,
    };

    const prescription = await createPrescriptionUseCase.execute(
      prescriptionData,
      doctorId,
      tenantId
    );

    // If there's an allergy warning, include it in the response
    if (prescription.allergyWarning && prescription.allergyDetails) {
      return res.status(201).json({
        success: true,
        message: 'Prescription created with allergy warning',
        warning: `ALLERGY WARNING: Patient is allergic to ${prescription.allergyDetails.join(', ')}`,
        data: prescription,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      data: prescription,
    });
  } catch (error: any) {
    logger.error('Error creating prescription:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create prescription',
    });
  }
};

/**
 * POST /api/consultations/:id/lab-tests
 * Order lab test from consultation
 * REQ-CLIN-4: Lab test ordering with clinical indication
 */
export const orderLabTest = async (req: Request, res: Response) => {
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

    const labTestData = {
      ...req.body,
      consultationId: id,
    };

    const labTest = await orderLabTestUseCase.execute(
      labTestData,
      doctorId,
      tenantId
    );

    return res.status(201).json({
      success: true,
      message: 'Lab test ordered successfully',
      data: labTest,
    });
  } catch (error: any) {
    logger.error('Error ordering lab test:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to order lab test',
    });
  }
};
