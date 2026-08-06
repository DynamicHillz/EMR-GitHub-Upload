/**
 * Patient Controller
 *
 * HTTP layer for patient operations
 * Handles request/response transformation and error handling
 *
 * User Stories Implemented:
 * - US-PAT-001: Patient Registration
 * - US-PAT-002: Medical History Capture
 * - US-PAT-003: Patient Search
 */

import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { RegisterPatientUseCase } from '../../application/use-cases/patient/register-patient.use-case';
import { SearchPatientsUseCase } from '../../application/use-cases/patient/search-patients.use-case';
import { GetPatientUseCase } from '../../application/use-cases/patient/get-patient.use-case';
import { UpdatePatientUseCase } from '../../application/use-cases/patient/update-patient.use-case';
import { DeletePatientUseCase } from '../../application/use-cases/patient/delete-patient.use-case';
import { GetPatientClinicalSummaryUseCase } from '../../application/use-cases/patient/get-patient-clinical-summary.use-case';
import { GetUnnamedNewbornsUseCase } from '../../application/use-cases/patient/get-unnamed-newborns.use-case';
import { PatientRepository } from '../../infrastructure/database/repositories/patient.repository';
import { PatientIdGenerator } from '../../infrastructure/generators/patient-id.generator';
import { prisma } from '../../infrastructure/database/prisma.client';
import { verificationService } from '../../application/services/verification.service';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

// Initialize dependencies
const patientRepository = new PatientRepository(prisma);
const patientIdGenerator = new PatientIdGenerator(prisma);

// Initialize use cases
const registerPatientUseCase = new RegisterPatientUseCase(patientRepository, patientIdGenerator, prisma);
const searchPatientsUseCase = new SearchPatientsUseCase(patientRepository);
const getPatientUseCase = new GetPatientUseCase(patientRepository);
const updatePatientUseCase = new UpdatePatientUseCase(patientRepository);
const deletePatientUseCase = new DeletePatientUseCase(patientRepository);
const getPatientClinicalSummaryUseCase = new GetPatientClinicalSummaryUseCase(prisma);
const getUnnamedNewbornsUseCase = new GetUnnamedNewbornsUseCase(prisma);

/**
 * GET /api/patients/unnamed-newborns
 * Follow-up worklist for newborns still carrying their placeholder
 * identity from delivery (see record-delivery-outcome.use-case.ts).
 */
export const getUnnamedNewborns = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const skip = (page - 1) * limit;
    const { newborns, total } = await getUnnamedNewbornsUseCase.execute(tenantId, { limit, skip });
    return res.status(200).json({
      success: true,
      data: newborns,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    logger.error('Error fetching unnamed newborns:', error);
    return res.status(500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to fetch unnamed newborns') });
  }
};

/**
 * POST /api/patients
 * US-PAT-001: Register a new patient
 */
export const registerPatient = async (req: Request, res: Response) => {
  try {
    // Extract tenantId from authenticated user (set by auth middleware)
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    // Execute use case
    const patient = await registerPatientUseCase.execute(req.body, tenantId);

    return res.status(201).json({
      success: true,
      message: 'Patient registered successfully',
      data: patient,
    });
  } catch (error: any) {
    logger.error('Error registering patient:', error);

    // Handle specific errors
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    // Two concurrent registrations for the same phone/patientId can both
    // pass the pre-check and race to the DB's own unique constraint — the
    // loser lands here with a raw Prisma error, not the friendly message
    // above, so it needs its own clean-409 handling.
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'A patient with this phone number or ID already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to register patient',
    });
  }
};

/**
 * GET /api/patients/search
 * US-PAT-003: Search patients by query, name, phone, or patient ID
 */
export const searchPatients = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    // Extract search parameters from query string
    const searchDto = {
      query: req.query.query as string,
      status: req.query.status as string,
      gender: req.query.gender as any,
      ageMin: req.query.ageMin ? parseInt(req.query.ageMin as string) : undefined,
      ageMax: req.query.ageMax ? parseInt(req.query.ageMax as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      // Already coerced to a real boolean by Joi (validateRequest runs
      // before this handler and replaces req.query with the validated value).
      lite: req.query.lite as unknown as boolean,
    };

    const result = await searchPatientsUseCase.execute(searchDto, tenantId);

    return res.status(200).json({
      success: true,
      data: result.patients,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    logger.error('Error searching patients:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to search patients',
    });
  }
};

/**
 * GET /api/patients/:id
 * Get a patient by ID (UUID)
 */
export const getPatientById = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { id } = req.params;

    const patient = await getPatientUseCase.executeById(id, tenantId);

    // Generate secure verification token for QR code
    const verificationToken = verificationService.generateVerificationToken({
      type: 'PATIENT',
      id: patient.id,
    });

    return res.status(200).json({
      success: true,
      data: {
        ...patient,
        verificationToken,
      },
    });
  } catch (error: any) {
    logger.error('Error getting patient:', error);

    if (error.message === 'Patient not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to get patient',
    });
  }
};

/**
 * GET /api/patients/:id/clinical-summary
 * Continuity-of-care bundle: the patient's active medications and recent
 * diagnosis history, for display alongside allergies/chronic conditions
 * when a clinician opens a consultation.
 */
export const getPatientClinicalSummary = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { id } = req.params;

    const summary = await getPatientClinicalSummaryUseCase.execute(id, tenantId);

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    logger.error('Error getting patient clinical summary:', error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to get patient clinical summary',
    });
  }
};

/**
 * GET /api/patients/patient-id/:patientId
 * Get a patient by patient number (e.g., P0000001)
 */
export const getPatientByPatientNumber = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { patientId } = req.params;

    const patient = await getPatientUseCase.executeByPatientId(patientId, tenantId);

    return res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (error: any) {
    logger.error('Error getting patient:', error);

    if (error.message === 'Patient not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to get patient',
    });
  }
};

/**
 * PUT /api/patients/:id
 * Update a patient
 */
export const updatePatient = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const { id } = req.params;

    const patient = await updatePatientUseCase.execute(id, req.body, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Patient updated successfully',
      data: patient,
    });
  } catch (error: any) {
    logger.error('Error updating patient:', error);

    if (error.message === 'Patient not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    // Two concurrent edits to the same/a colliding phone number can both
    // pass the use-case's pre-check and race to the DB's own unique
    // constraint — the loser lands here with a raw Prisma error, same as
    // registerPatient's equivalent branch.
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'A patient with this phone number already exists',
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to update patient',
    });
  }
};

/**
 * DELETE /api/patients/:id
 * Soft delete a patient
 */
export const deletePatient = async (req: Request, res: Response) => {
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

    await deletePatientUseCase.execute(id, tenantId, userId);

    return res.status(200).json({
      success: true,
      message: 'Patient deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting patient:', error);

    // NotFoundError('Patient', id) carries its own statusCode (404) and a
    // message that includes the identifier — checking error.statusCode
    // directly (as updatePatient's equivalent branch already does) instead
    // of matching an exact message string means this doesn't silently break
    // if that message format ever changes, unlike a literal
    // error.message === 'Patient not found' check, which this route
    // previously used and which never actually matched (the real message
    // is "Patient with identifier '<id>' not found"), always falling
    // through to a 500 for what should have been a 404.
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to delete patient',
    });
  }
};
