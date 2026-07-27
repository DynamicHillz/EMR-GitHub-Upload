/**
 * Tenant Controller
 *
 * SUPER_ADMIN-only clinic (tenant) management — create/list/suspend.
 * Replaces scripts/final-create-admin.js as the in-app onboarding path.
 */

import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { CreateTenantUseCase } from '../../application/use-cases/tenant/create-tenant.use-case';
import { ListTenantsUseCase } from '../../application/use-cases/tenant/list-tenants.use-case';
import { UpdateTenantStatusUseCase } from '../../application/use-cases/tenant/update-tenant-status.use-case';
import { logger } from '../../config/logger';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

const statusCodeFor = (error: any): number => {
  if (error.name === 'ValidationError') return 400;
  if (error.name === 'NotFoundError') return 404;
  if (error.name === 'ConflictError') return 409;
  return 500;
};

/**
 * POST /api/tenants
 * Create a new clinic + its first ADMIN user
 */
export const createTenant = async (req: Request, res: Response) => {
  try {
    const createdBy = req.user!.id;
    const useCase = new CreateTenantUseCase(prisma);
    const result = await useCase.execute(req.body, createdBy);

    res.status(201).json({
      success: true,
      message: 'Tenant created successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Create tenant error:', error);
    res.status(statusCodeFor(error)).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to create tenant'),
    });
  }
};

/**
 * GET /api/tenants
 * List all tenants (platform-wide, not scoped to the caller's own tenant)
 */
export const listTenants = async (req: Request, res: Response) => {
  try {
    const { page, limit, search, status } = req.query;
    const useCase = new ListTenantsUseCase(prisma);
    const result = await useCase.execute({
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      search: search as string | undefined,
      status: status as string | undefined,
    });

    res.json({
      success: true,
      data: result.tenants,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.error('List tenants error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list tenants',
    });
  }
};

/**
 * PATCH /api/tenants/:id/status
 * Suspend/reactivate/deactivate a clinic
 */
export const updateTenantStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updatedBy = req.user!.id;

    const useCase = new UpdateTenantStatusUseCase(prisma);
    const tenant = await useCase.execute(id, status, updatedBy);

    res.json({
      success: true,
      message: 'Tenant status updated successfully',
      data: tenant,
    });
  } catch (error: any) {
    logger.error('Update tenant status error:', error);
    res.status(statusCodeFor(error)).json({
      success: false,
      message: getSafeErrorMessage(error, 'Failed to update tenant status'),
    });
  }
};
