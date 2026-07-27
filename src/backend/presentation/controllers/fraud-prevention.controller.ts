/**
 * Fraud Prevention Settings Controller
 *
 * Full admin CRUD for FraudPreventionSettings — distinct from
 * billing.controller.ts's getFraudPreventionSettingsForPaymentForm, which
 * only exposes the narrow read-only subset the payment form itself needs.
 */

import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { GetFraudPreventionSettingsUseCase } from '../../application/use-cases/tenant/get-fraud-prevention-settings.use-case';
import { UpdateFraudPreventionSettingsUseCase } from '../../application/use-cases/tenant/update-fraud-prevention-settings.use-case';
import { logger } from '../../config/logger';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

export const getFraudPreventionSettings = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No tenant ID found' });
    }

    const useCase = new GetFraudPreventionSettingsUseCase(prisma);
    const settings = await useCase.execute(tenantId);

    res.json({ success: true, data: settings });
  } catch (error: any) {
    logger.error('Get fraud prevention settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fraud prevention settings' });
  }
};

export const updateFraudPreventionSettings = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No tenant ID found' });
    }

    const useCase = new UpdateFraudPreventionSettingsUseCase(prisma);
    const settings = await useCase.execute(tenantId, req.body);

    res.json({ success: true, message: 'Fraud prevention settings updated successfully', data: settings });
  } catch (error: any) {
    logger.error('Update fraud prevention settings error:', error);
    const statusCode = error.name === 'ValidationError' ? 400 : error.name === 'NotFoundError' ? 404 : 500;
    res.status(statusCode).json({ success: false, message: getSafeErrorMessage(error, 'Failed to update fraud prevention settings') });
  }
};
