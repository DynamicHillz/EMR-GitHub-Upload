/**
 * License Controller
 *
 * On-premise licensing status + renewal. Status is readable by any
 * authenticated role (informational, not sensitive — the frontend decides
 * who actually sees the banner); updating the license is SUPER_ADMIN-only,
 * enforced in license.routes.ts.
 */

import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { GetLicenseStatusUseCase } from '../../application/use-cases/tenant/get-license-status.use-case';
import { UpdateLicenseUseCase } from '../../application/use-cases/tenant/update-license.use-case';
import { logger } from '../../config/logger';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

const statusCodeFor = (error: any): number => {
  if (error.name === 'ValidationError') return 400;
  if (error.name === 'NotFoundError') return 404;
  return 500;
};

/**
 * GET /api/license/status
 */
export const getLicenseStatus = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const useCase = new GetLicenseStatusUseCase(prisma);
    const result = await useCase.execute(tenantId);

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Get license status error:', error);
    res.status(statusCodeFor(error)).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to get license status'),
    });
  }
};

/**
 * PUT /api/license
 */
export const updateLicense = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { licenseToken } = req.body;

    const useCase = new UpdateLicenseUseCase(prisma);
    await useCase.execute(tenantId, licenseToken);

    res.json({ success: true, message: 'License updated successfully' });
  } catch (error: any) {
    logger.error('Update license error:', error);
    res.status(statusCodeFor(error)).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to update license'),
    });
  }
};
