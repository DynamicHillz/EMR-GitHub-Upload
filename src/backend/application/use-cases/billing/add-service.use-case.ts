/**
 * Add Service Use Case
 *
 * REQ-BILL-6: Add new service to catalog with configurable pricing
 */

import { PrismaClient } from '@prisma/client';
import type { ServiceCategory } from '../../../shared/types/prisma-enums.ts';;
import { ConflictError, ValidationError } from '../../../shared/errors/AppError';

export interface AddServiceDto {
  serviceCode: string;
  serviceName: string;
  description?: string;
  category: ServiceCategory;
  basePrice: number;
  taxRate?: number;
  isActive?: boolean;
}

export class AddServiceUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: AddServiceDto, tenantId: string) {
    // Check if service code already exists for this tenant
    const existing = await this.prisma.serviceCatalog.findUnique({
      where: {
        tenantId_serviceCode: {
          tenantId,
          serviceCode: dto.serviceCode
        }
      }
    });

    if (existing) {
      throw new ConflictError(`Service with code '${dto.serviceCode}' already exists`);
    }

    // Validate price
    if (dto.basePrice < 0) {
      throw new ValidationError('Base price cannot be negative');
    }

    // Validate tax rate
    if (dto.taxRate !== undefined && (dto.taxRate < 0 || dto.taxRate > 100)) {
      throw new ValidationError('Tax rate must be between 0 and 100');
    }

    const service = await this.prisma.serviceCatalog.create({
      data: {
        tenantId,
        serviceCode: dto.serviceCode,
        serviceName: dto.serviceName,
        description: dto.description,
        category: dto.category,
        basePrice: dto.basePrice,
        taxRate: dto.taxRate || 0,
        isActive: dto.isActive !== undefined ? dto.isActive : true
      }
    });

    return service;
  }
}
