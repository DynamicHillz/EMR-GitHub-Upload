/**
 * Get Service Catalog Use Case
 *
 * REQ-BILL-6: Retrieve configurable pricing from service catalog per clinic
 */

import { PrismaClient } from '@prisma/client';
import type { ServiceCategory } from '../../../shared/types/prisma-enums.ts';;

export interface ServiceDto {
  id: string;
  serviceCode: string;
  serviceName: string;
  description?: string;
  category: ServiceCategory;
  basePrice: number;
  taxRate: number;
  isActive: boolean;
}

export class GetServiceCatalogUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, activeOnly: boolean = true): Promise<ServiceDto[]> {
    const where: any = { tenantId };

    if (activeOnly) {
      where.isActive = true;
    }

    const services = await this.prisma.serviceCatalog.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { serviceName: 'asc' }
      ]
    });

    return services.map(service => ({
      id: service.id,
      serviceCode: service.serviceCode,
      serviceName: service.serviceName,
      description: service.description || undefined,
      category: service.category,
      basePrice: service.basePrice,
      taxRate: service.taxRate,
      isActive: service.isActive
    }));
  }

  async getByCategory(tenantId: string, category: ServiceCategory): Promise<ServiceDto[]> {
    const services = await this.prisma.serviceCatalog.findMany({
      where: {
        tenantId,
        category,
        isActive: true
      },
      orderBy: { serviceName: 'asc' }
    });

    return services.map(service => ({
      id: service.id,
      serviceCode: service.serviceCode,
      serviceName: service.serviceName,
      description: service.description || undefined,
      category: service.category,
      basePrice: service.basePrice,
      taxRate: service.taxRate,
      isActive: service.isActive
    }));
  }
}
