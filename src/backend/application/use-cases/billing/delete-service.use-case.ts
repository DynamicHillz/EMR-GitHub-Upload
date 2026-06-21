/**
 * Delete Service Use Case
 *
 * REQ-BILL-6: Deactivate service from catalog (soft delete)
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../shared/errors/AppError';

export class DeleteServiceUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(serviceId: string, tenantId: string) {
    // Check if service exists and belongs to tenant
    const existing = await this.prisma.serviceCatalog.findFirst({
      where: {
        id: serviceId,
        tenantId
      }
    });

    if (!existing) {
      throw new NotFoundError('Service', serviceId);
    }

    // Soft delete - just set isActive to false
    const service = await this.prisma.serviceCatalog.update({
      where: { id: serviceId },
      data: {
        isActive: false
      }
    });

    return service;
  }

  // For hard delete if needed
  async hardDelete(serviceId: string, tenantId: string) {
    // Check if service exists and belongs to tenant
    const existing = await this.prisma.serviceCatalog.findFirst({
      where: {
        id: serviceId,
        tenantId
      }
    });

    if (!existing) {
      throw new NotFoundError('Service', serviceId);
    }

    // Hard delete - permanently remove
    await this.prisma.serviceCatalog.delete({
      where: { id: serviceId }
    });

    return { success: true, message: 'Service permanently deleted' };
  }
}
