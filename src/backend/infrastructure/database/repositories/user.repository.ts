/**
 * User Repository Implementation
 * Prisma implementation of IUserRepository
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  IUserRepository,
  IUser,
  CreateUserData,
  UpdateUserData,
  UserFilters,
} from '../../../domain/interfaces/IUserRepository';

export class UserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<IUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
    }) as Promise<IUser | null>;
  }

  async findByEmail(email: string, tenantId: string): Promise<IUser | null> {
    return this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email,
        },
      },
    }) as Promise<IUser | null>;
  }

  async findAll(filters: UserFilters): Promise<IUser[]> {
    const where: Prisma.UserWhereInput = {
      tenantId: filters.tenantId,
    };

    if (filters.role) {
      where.role = filters.role as any;
    }

    if (filters.status) {
      where.status = filters.status as any;
    }

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, } },
        { lastName: { contains: filters.search, } },
        { email: { contains: filters.search, } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      take: filters.limit,
      skip: filters.offset,
      orderBy: {
        createdAt: 'desc',
      },
    }) as Promise<IUser[]>;
  }

  async create(data: CreateUserData): Promise<IUser> {
    const createData: Prisma.UserCreateInput = {
      tenant: {
        connect: { id: data.tenantId },
      },
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: data.role as any,
      status: (data.status || 'ACTIVE') as any,
      failedLoginAttempts: 0,
    };

    return this.prisma.user.create({
      data: createData,
    }) as Promise<IUser>;
  }

  async update(id: string, data: UpdateUserData): Promise<IUser> {
    const updateData: Prisma.UserUpdateInput = {
      ...(data.firstName && { firstName: data.firstName }),
      ...(data.lastName && { lastName: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.role && { role: data.role as any }),
      ...(data.status && { status: data.status as any }),
    };

    return this.prisma.user.update({
      where: { id },
      data: updateData,
    }) as Promise<IUser>;
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async updateFailedAttempts(id: string, attempts: number, lockedUntil?: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil,
      },
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        lastLogin: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async deactivate(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        status: 'INACTIVE',
      },
    });
  }

  async reactivate(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async suspend(id: string, until?: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        status: 'SUSPENDED',
        lockedUntil: until,
      },
    });
  }

  async count(filters: Omit<UserFilters, 'limit' | 'offset'>): Promise<number> {
    const where: Prisma.UserWhereInput = {
      tenantId: filters.tenantId,
    };

    if (filters.role) {
      where.role = filters.role as any;
    }

    if (filters.status) {
      where.status = filters.status as any;
    }

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, } },
        { lastName: { contains: filters.search, } },
        { email: { contains: filters.search, } },
      ];
    }

    return this.prisma.user.count({ where });
  }

  /**
   * Additional methods for password reset tokens
   */
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    // Mark all existing tokens as used
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, used: false },
      data: { used: true },
    });

    // Create new token
    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  async findPasswordResetToken(token: string): Promise<any> {
    return this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { token },
      data: { used: true },
    });
  }

  /**
   * Additional methods for refresh tokens
   */
  async createRefreshToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  async findRefreshToken(token: string): Promise<any> {
    return this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { token },
      data: { revoked: true },
    });
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }
}
