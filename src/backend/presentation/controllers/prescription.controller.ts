/**
 * Prescription Controller
 *
 * HTTP request handlers for prescription listing/creation shared across
 * consultation, inpatient (Postop Plan), and ANC prescribing contexts.
 */

import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { CreatePrescriptionUseCase } from '../../application/use-cases/consultation/create-prescription.use-case';
import { checkDrugInteractions, checkDuplicateTherapy } from '../../application/services/drug-interaction-checker.service';
import { PatientRepository } from '../../infrastructure/database/repositories/patient.repository';
import { prisma } from '../../infrastructure/database/prisma.client';

const patientRepository = new PatientRepository(prisma);
const createPrescriptionUseCase = new CreatePrescriptionUseCase(prisma, patientRepository);

/**
 * GET /api/prescriptions
 * List prescriptions filtered by any combination of consultationId, patientId,
 * admissionId, ancVisitId, and status.
 */
export const getPrescriptions = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { consultationId, patientId, admissionId, ancVisitId, status } = req.query;

    const where: any = { tenantId };

    if (consultationId) where.consultationId = consultationId as string;
    if (patientId) where.patientId = patientId as string;
    if (admissionId) where.admissionId = admissionId as string;
    if (ancVisitId) where.ancVisitId = ancVisitId as string;
    if (status) where.status = status as string;

    const prescriptions = await prisma.prescription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: prescriptions,
      total: prescriptions.length,
    });
  } catch (error: any) {
    logger.error('Error getting prescriptions:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to get prescriptions',
    });
  }
};

/**
 * GET /api/prescriptions/check-interactions?patientId=X&medicationName=Y
 * Live, pre-submit check so the prescriber sees an interaction warning
 * before creating the prescription, not just the pharmacist at dispense
 * time. Uses the exact same logic as prescription creation itself.
 */
export const checkInteractions = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { patientId, medicationName } = req.query;
    if (!patientId || !medicationName) {
      return res.status(400).json({ success: false, message: 'patientId and medicationName are required' });
    }

    const [interactionResult, duplicateResult] = await Promise.all([
      checkDrugInteractions(prisma, tenantId, patientId as string, medicationName as string),
      checkDuplicateTherapy(prisma, tenantId, patientId as string, medicationName as string),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        interactionWarning: interactionResult.interactionWarning,
        interactionDetails: interactionResult.interactionDetails,
        interactionHighestSeverity: interactionResult.highestSeverity,
        duplicateWarning: duplicateResult.duplicateWarning,
        duplicateDetails: duplicateResult.duplicateDetails,
        duplicateHighestSeverity: duplicateResult.highestSeverity,
      },
    });
  } catch (error: any) {
    logger.error('Error checking drug interactions:', error);
    return res.status(500).json({ success: false, message: 'Failed to check drug interactions' });
  }
};

/**
 * POST /api/prescriptions
 * Create a prescription for the admission (Postop Plan) or ANC visit context.
 * Consultation-based prescribing continues to use
 * POST /api/consultations/:id/prescriptions.
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

    const prescription = await createPrescriptionUseCase.execute(req.body, doctorId, tenantId);

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
