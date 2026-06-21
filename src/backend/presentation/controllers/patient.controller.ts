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
import { PatientRepository } from '../../infrastructure/database/repositories/patient.repository';
import { PatientIdGenerator } from '../../infrastructure/generators/patient-id.generator';
import { prisma } from '../../infrastructure/database/prisma.client';

// Initialize dependencies
const patientRepository = new PatientRepository(prisma);
const patientIdGenerator = new PatientIdGenerator(prisma);

// Initialize use cases
const registerPatientUseCase = new RegisterPatientUseCase(patientRepository, patientIdGenerator);
const searchPatientsUseCase = new SearchPatientsUseCase(patientRepository);
const getPatientUseCase = new GetPatientUseCase(patientRepository);
const updatePatientUseCase = new UpdatePatientUseCase(patientRepository);
const deletePatientUseCase = new DeletePatientUseCase(patientRepository);

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

    return res.status(500).json({
      success: false,
      message: 'Failed to register patient',
      error: error.message,
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
      error: error.message,
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
      error: error.message,
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
      error: error.message,
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

    return res.status(500).json({
      success: false,
      message: 'Failed to update patient',
      error: error.message,
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

    await deletePatientUseCase.execute(id, tenantId);

    return res.status(200).json({
      success: true,
      message: 'Patient deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting patient:', error);

    if (error.message === 'Patient not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to delete patient',
      error: error.message,
    });
  }
};
