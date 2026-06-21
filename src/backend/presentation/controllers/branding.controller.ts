/**
 * Branding Controller
 *
 * Handles tenant branding customization (logo, colors, theme)
 */

import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { GetBrandingUseCase } from '../../application/use-cases/tenant/get-branding.use-case';
import { UpdateBrandingUseCase } from '../../application/use-cases/tenant/update-branding.use-case';
import { logger } from '../../config/logger';

/**
 * GET /api/branding/public
 * Get branding settings for login page (no auth required)
 * Returns the first active tenant's branding
 */
export const getPublicBranding = async (_req: Request, res: Response) => {
  try {
    // For public access, get the first active tenant
    const firstTenant = await prisma.tenant.findFirst({
      where: { status: 'ACTIVE' },
      select: { id: true }
    });

    if (!firstTenant) {
      // Return default branding if no tenant exists
      return res.json({
        success: true,
        data: {
          clinicName: 'SSMC EMR',
          logoUrl: null,
          primaryColor: '#2563eb',
          secondaryColor: '#1e40af'
        }
      });
    }

    const useCase = new GetBrandingUseCase(prisma);
    const branding = await useCase.execute(firstTenant.id);

    res.json({
      success: true,
      data: branding
    });
  } catch (error: any) {
    logger.error('Get public branding error:', error);
    // Return default branding on error instead of 500
    res.json({
      success: true,
      data: {
        clinicName: 'SSMC EMR',
        logoUrl: null,
        primaryColor: '#2563eb',
        secondaryColor: '#1e40af'
      }
    });
  }
};

/**
 * GET /api/branding
 * Get current tenant branding settings
 */
export const getBranding = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found'
      });
    }

    const useCase = new GetBrandingUseCase(prisma);
    const branding = await useCase.execute(tenantId);

    res.json({
      success: true,
      data: branding
    });
  } catch (error: any) {
    logger.error('Get branding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch branding settings',
      error: error.message
    });
  }
};

/**
 * PUT /api/branding
 * Update tenant branding settings
 */
export const updateBranding = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found'
      });
    }

    // Only admins can update branding
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only admins can update branding'
      });
    }

    const useCase = new UpdateBrandingUseCase(prisma);
    const branding = await useCase.execute(tenantId, req.body);

    res.json({
      success: true,
      message: 'Branding updated successfully',
      data: branding
    });
  } catch (error: any) {
    logger.error('Update branding error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update branding',
      error: error.message
    });
  }
};

/**
 * POST /api/branding/upload-logo
 * Upload clinic logo (placeholder for file upload)
 */
export const uploadLogo = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found'
      });
    }

    // Only admins can upload logo
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only admins can upload logo'
      });
    }

    // TODO: Implement file upload using multer or similar
    // For now, we'll accept a URL
    const { logoUrl } = req.body;

    if (!logoUrl) {
      return res.status(400).json({
        success: false,
        message: 'Logo URL is required'
      });
    }

    const useCase = new UpdateBrandingUseCase(prisma);
    const branding = await useCase.execute(tenantId, { logoUrl });

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: branding
    });
  } catch (error: any) {
    logger.error('Upload logo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload logo',
      error: error.message
    });
  }
};
