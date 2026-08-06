/**
 * Labor Controller
 *
 * Labor & partograph tracking — starting labor, recording periodic
 * observations, recording delivery outcomes, and the active-labors worklist.
 */

import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { logger } from '../../config/logger';
import { StartLaborUseCase } from '../../application/use-cases/labor/start-labor.use-case';
import { RecordPartographObservationUseCase } from '../../application/use-cases/labor/record-partograph-observation.use-case';
import { RecordDeliveryOutcomeUseCase } from '../../application/use-cases/labor/record-delivery-outcome.use-case';
import { DiscontinueLaborUseCase } from '../../application/use-cases/labor/discontinue-labor.use-case';
import { GetLaborRecordUseCase } from '../../application/use-cases/labor/get-labor-record.use-case';
import { GetActiveLaborsUseCase } from '../../application/use-cases/labor/get-active-labors.use-case';
import { GetBillableLaborRecordsUseCase } from '../../application/use-cases/labor/get-billable-labor-records.use-case';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

const startLaborUseCase = new StartLaborUseCase(prisma);
const recordPartographObservationUseCase = new RecordPartographObservationUseCase(prisma);
const recordDeliveryOutcomeUseCase = new RecordDeliveryOutcomeUseCase(prisma);
const discontinueLaborUseCase = new DiscontinueLaborUseCase(prisma);
const getLaborRecordUseCase = new GetLaborRecordUseCase(prisma);
const getActiveLaborsUseCase = new GetActiveLaborsUseCase(prisma);
const getBillableLaborRecordsUseCase = new GetBillableLaborRecordsUseCase(prisma);

export const startLabor = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { admissionId } = req.params;
    const dto = {
      laborOnsetAt: req.body.laborOnsetAt ? new Date(req.body.laborOnsetAt) : undefined,
      onsetType: req.body.onsetType,
      romAt: req.body.romAt ? new Date(req.body.romAt) : undefined,
      romType: req.body.romType,
      liquorAtRom: req.body.liquorAtRom,
      pregnancyId: req.body.pregnancyId,
    };

    const laborRecord = await startLaborUseCase.execute(tenantId, admissionId, dto, userId);

    return res.status(201).json({ success: true, message: 'Labor tracking started successfully', data: laborRecord });
  } catch (error: any) {
    logger.error('Error starting labor tracking:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to start labor tracking') });
  }
};

export const getLaborRecordByAdmission = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { admissionId } = req.params;
    const laborRecord = await getLaborRecordUseCase.execute(tenantId, admissionId);

    return res.status(200).json({ success: true, message: 'Labor record retrieved successfully', data: laborRecord });
  } catch (error: any) {
    logger.error('Error fetching labor record:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to fetch labor record') });
  }
};

export const recordObservation = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { laborRecordId } = req.params;
    const dto = {
      ...req.body,
      recordedAt: req.body.recordedAt ? new Date(req.body.recordedAt) : undefined,
    };

    const observation = await recordPartographObservationUseCase.execute(tenantId, laborRecordId, dto, userId);

    return res.status(201).json({ success: true, message: 'Observation recorded successfully', data: observation });
  } catch (error: any) {
    logger.error('Error recording partograph observation:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to record observation') });
  }
};

export const recordDeliveryOutcome = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { laborRecordId } = req.params;
    const dto = {
      ...req.body,
      deliveredAt: req.body.deliveredAt ? new Date(req.body.deliveredAt) : undefined,
    };

    const result = await recordDeliveryOutcomeUseCase.execute(tenantId, laborRecordId, dto, userId);

    return res.status(200).json({ success: true, message: 'Delivery outcome recorded successfully', data: result });
  } catch (error: any) {
    logger.error('Error recording delivery outcome:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to record delivery outcome') });
  }
};

export const discontinueLabor = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { laborRecordId } = req.params;
    const laborRecord = await discontinueLaborUseCase.execute(tenantId, laborRecordId, req.body, userId);

    return res.status(200).json({ success: true, message: 'Labor record closed out successfully', data: laborRecord });
  } catch (error: any) {
    logger.error('Error discontinuing labor record:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to close out labor record') });
  }
};

export const getActiveLabors = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const activeLabors = await getActiveLaborsUseCase.execute(tenantId);

    return res.status(200).json({ success: true, message: 'Active labors retrieved successfully', data: activeLabors });
  } catch (error: any) {
    logger.error('Error fetching active labors:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to fetch active labors') });
  }
};

export const getBillableLaborRecords = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const patientId = req.query.patientId as string;
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'patientId is required' });
    }

    const result = await getBillableLaborRecordsUseCase.execute(tenantId, patientId);

    return res.status(200).json({ success: true, message: 'Billable labor records retrieved successfully', data: result.data });
  } catch (error: any) {
    logger.error('Error fetching billable labor records:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to fetch billable labor records') });
  }
};
