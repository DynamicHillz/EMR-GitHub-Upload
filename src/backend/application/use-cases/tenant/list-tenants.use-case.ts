/**
 * List Tenants Use Case
 *
 * SUPER_ADMIN-only, paginated list across ALL tenants — unlike every other
 * list use-case in this codebase, this one deliberately has no tenantId
 * scoping filter, since a platform operator needs to see every clinic.
 */

import { PrismaClient, Prisma } from '@prisma/client';

export interface ListTenantsFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export class ListTenantsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(filters: ListTenantsFilters) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;

    const where: Prisma.TenantWhereInput = {};
    if (filters.status) {
      where.status = filters.status as any;
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { clinicName: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          clinicName: true,
          status: true,
          subscriptionTier: true,
          subscriptionStart: true,
          subscriptionEnd: true,
          createdAt: true,
          _count: { select: { users: true, patients: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      tenants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
