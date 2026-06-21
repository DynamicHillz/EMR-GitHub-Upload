/**
 * Update Service Use Case
 *
 * REQ-BILL-6: Update service details and pricing in catalog
 */

import { PrismaClient } from '@prisma/client';
import type { ServiceCategory } from '../../../shared/types/prisma-enums.ts';;
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export interface UpdateServiceDto {
  serviceName?: string;
  description?: string;
  category?: ServiceCategory;
  basePrice?: number;
  taxRate?: number;
  isActive?: boolean;
}

export class UpdateServiceUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(serviceId: string, dto: UpdateServiceDto, tenantId: string) {
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

    // Validate price if provided
    if (dto.basePrice !== undefined && dto.basePrice < 0) {
      throw new ValidationError('Base price cannot be negative');
    }

    // Validate tax rate if provided
    if (dto.taxRate !== undefined && (dto.taxRate < 0 || dto.taxRate > 100)) {
      throw new ValidationError('Tax rate must be between 0 and 100');
    }

    const service = await this.prisma.serviceCatalog.update({
      where: { id: serviceId },
      data: {
        serviceName: dto.serviceName,
        description: dto.description,
        category: dto.category,
        basePrice: dto.basePrice,
        taxRate: dto.taxRate,
        isActive: dto.isActive
      }
    });

    return service;
  }
}
