/**
 * List Users Use Case
 * Retrieves users with filters and pagination
 */

import { PrismaClient } from '@prisma/client';
import { UserResponseDto } from '../../dtos/user/CreateUser.dto';
import { logger } from '../../../config/logger';

export interface ListUsersFilters {
  tenantId: string;
  role?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
  /** Role of the user making the request — a plain ADMIN must never see
   * SUPER_ADMIN accounts in this list, regardless of any role filter. */
  viewerRole?: string;
}

export interface ListUsersResponse {
  users: UserResponseDto[];
  total: number;
  limit: number;
  offset: number;
}

export class ListUsersUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(filters: ListUsersFilters): Promise<ListUsersResponse> {
    try {
      const where: any = {
        tenantId: filters.tenantId,
      };

      if (filters.role) {
        where.role = filters.role;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search, } },
          { lastName: { contains: filters.search, } },
          { email: { contains: filters.search, } },
        ];
      }

      if (filters.viewerRole !== 'SUPER_ADMIN') {
        where.NOT = { role: 'SUPER_ADMIN' };
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({ where }),
      ]);

      const userDtos: UserResponseDto[] = users.map((user: any) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || undefined,
        role: user.role,
        status: user.status,
        tenantId: user.tenantId,
        lastLogin: user.lastLogin || undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      return {
        users: userDtos,
        total,
        limit,
        offset,
      };
    } catch (error: any) {
      logger.error('List users error:', error);
      throw error;
    }
  }
}
