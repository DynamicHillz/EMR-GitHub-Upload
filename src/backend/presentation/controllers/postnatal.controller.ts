/**
 * Postnatal Controller
 *
 * Postnatal (PNC) visit recording, history, and the clinic-wide due
 * worklist — mirrors labor.controller.ts's structure.
 */

import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { logger } from '../../config/logger';
import { RecordPostnatalVisitUseCase } from '../../application/use-cases/postnatal/record-postnatal-visit.use-case';
import { GetPostnatalVisitsUseCase } from '../../application/use-cases/postnatal/get-postnatal-visits.use-case';
import { GetPostnatalWorklistUseCase } from '../../application/use-cases/postnatal/get-postnatal-worklist.use-case';
import { GetBillablePostnatalVisitsUseCase } from '../../application/use-cases/postnatal/get-billable-postnatal-visits.use-case';
import { DismissWorklistItemUseCase } from '../../application/use-cases/worklist/dismiss-worklist-item.use-case';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

const recordPostnatalVisitUseCase = new RecordPostnatalVisitUseCase(prisma);
const getPostnatalVisitsUseCase = new GetPostnatalVisitsUseCase(prisma);
const getPostnatalWorklistUseCase = new GetPostnatalWorklistUseCase(prisma);
const getBillablePostnatalVisitsUseCase = new GetBillablePostnatalVisitsUseCase(prisma);
const dismissWorklistItemUseCase = new DismissWorklistItemUseCase(prisma);

export const recordPostnatalVisit = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { patientId } = req.params;
    const dto = {
      ...req.body,
      visitDate: req.body.visitDate ? new Date(req.body.visitDate) : undefined,
    };

    const visit = await recordPostnatalVisitUseCase.execute(tenantId, patientId, dto, userId);

    return res.status(201).json({ success: true, message: 'Postnatal visit recorded successfully', data: visit });
  } catch (error: any) {
    logger.error('Error recording postnatal visit:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to record postnatal visit') });
  }
};

export const getPostnatalVisitsByPatient = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { patientId } = req.params;
    const pregnancyId = req.query.pregnancyId as string | undefined;
    const visits = await getPostnatalVisitsUseCase.execute(tenantId, patientId, pregnancyId);

    return res.status(200).json({ success: true, message: 'Postnatal visits retrieved successfully', data: visits });
  } catch (error: any) {
    logger.error('Error fetching postnatal visits:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to fetch postnatal visits') });
  }
};

export const getPostnatalWorklist = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const withinDays = req.query.withinDays ? parseInt(req.query.withinDays as string, 10) : 7;
    const worklist = await getPostnatalWorklistUseCase.execute(tenantId, withinDays);

    // Computed in memory (per-delivery contact schedule diffed against
    // recorded visits, not something the DB can page for us) — pagination
    // here is a slice over the already date-bounded result (see the
    // use-case's 6-week delivery cutoff), same approach as
    // immunization.controller.ts#getOverdueImmunizations.
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const start = (page - 1) * limit;
    const paged = worklist.slice(start, start + limit);

    return res.status(200).json({
      success: true,
      message: 'Postnatal worklist retrieved successfully',
      data: paged,
      total: worklist.length,
      page,
      totalPages: Math.ceil(worklist.length / limit) || 1,
    });
  } catch (error: any) {
    logger.error('Error fetching postnatal worklist:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to fetch postnatal worklist') });
  }
};

export const getBillablePostnatalVisits = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const patientId = req.query.patientId as string;
    if (!patientId) return res.status(400).json({ success: false, message: 'patientId is required' });

    const result = await getBillablePostnatalVisitsUseCase.execute(tenantId, patientId);

    return res.status(200).json({ success: true, message: 'Billable postnatal visits retrieved successfully', data: result.data });
  } catch (error: any) {
    logger.error('Error fetching billable postnatal visits:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to fetch billable postnatal visits') });
  }
};

// Resolves a false-positive due-item (mother declined/transferred/deceased,
// or the contact happened elsewhere) without fabricating a visit that
// never happened. See WorklistDismissal in schema.prisma.
export const dismissDuePostnatal = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { patientId } = req.params;
    const { pregnancyId, contactType, reason, reasonNotes } = req.body;
    const dismissal = await dismissWorklistItemUseCase.execute(
      tenantId,
      { worklistType: 'POSTNATAL_DUE', patientId, pregnancyId, contactType, reason, reasonNotes },
      userId
    );

    return res.status(201).json({ success: true, message: 'Due item dismissed', data: dismissal });
  } catch (error: any) {
    logger.error('Error dismissing postnatal due item:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: getSafeErrorMessage(error, 'Failed to dismiss due item') });
  }
};
