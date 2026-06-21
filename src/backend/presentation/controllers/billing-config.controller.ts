/**
 * Billing Configuration Controller
 *
 * Handles billing configuration endpoints
 */

import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { GetBillingConfigUseCase } from '../../application/use-cases/tenant/get-billing-config.use-case';
import { UpdateBillingConfigUseCase } from '../../application/use-cases/tenant/update-billing-config.use-case';
import { logger } from '../../config/logger';

/**
 * GET /api/billing/config
 * Get billing configuration settings
 */
export const getBillingConfig = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found'
      });
    }

    const useCase = new GetBillingConfigUseCase(prisma);
    const config = await useCase.execute(tenantId);

    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    logger.error('Get billing config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch billing configuration',
      error: error.message
    });
  }
};

/**
 * PUT /api/billing/config
 * Update billing configuration settings
 * - General settings: ADMIN or SUPER_ADMIN
 * - Payment gateway keys: SUPER_ADMIN only (for security)
 */
export const updateBillingConfig = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found'
      });
    }

    // Only admins can update billing configuration
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only admins can update billing configuration'
      });
    }

    // Check if payment gateway fields are being updated
    const paymentGatewayFields = [
      'paystackEnabled', 'paystackPublicKey', 'paystackSecretKey',
      'flutterwaveEnabled', 'flutterwavePublicKey', 'flutterwaveSecretKey',
      'moniepointEnabled', 'moniepointApiKey', 'moniepointContractCode'
    ];

    const hasPaymentGatewayUpdates = paymentGatewayFields.some(field => req.body[field] !== undefined);

    // Payment gateway configuration requires SUPER_ADMIN only
    if (hasPaymentGatewayUpdates && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only super admins can configure payment gateway API keys for security reasons'
      });
    }

    const useCase = new UpdateBillingConfigUseCase(prisma);
    const config = await useCase.execute(tenantId, req.body);

    res.json({
      success: true,
      message: 'Billing configuration updated successfully',
      data: config
    });
  } catch (error: any) {
    logger.error('Update billing config error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update billing configuration',
      error: error.message
    });
  }
};
