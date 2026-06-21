/**
 * Refresh Token Use Case
 * Handles access token refresh
 */

import { PrismaClient } from '@prisma/client';
import { TokenService } from '../../../infrastructure/services/token.service';
import { logger } from '../../../config/logger';

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class RefreshTokenUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      // Find refresh token
      const token = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!token) {
        throw new Error('Invalid refresh token');
      }

      // Check if token is revoked
      if (token.revoked) {
        throw new Error('Refresh token has been revoked');
      }

      // Check if token is expired
      if (new Date() > token.expiresAt) {
        throw new Error('Refresh token has expired');
      }

      // Check if user is active
      if (token.user.status !== 'ACTIVE') {
        throw new Error('User account is not active');
      }

      // Generate new access token
      const newAccessToken = TokenService.generateAccessToken({
        id: token.user.id,
        email: token.user.email,
        role: token.user.role,
        tenantId: token.user.tenantId,
      });

      // Generate new refresh token (rotation for security)
      const newRefreshToken = TokenService.generateRefreshToken();
      const expiresAt = TokenService.calculateExpiryDate(
        process.env.JWT_REFRESH_EXPIRY || '30d'
      );

      // Revoke old refresh token
      await this.prisma.refreshToken.update({
        where: { token: refreshToken },
        data: { revoked: true },
      });

      // Create new refresh token
      await this.prisma.refreshToken.create({
        data: {
          userId: token.user.id,
          token: newRefreshToken,
          expiresAt,
        },
      });

      logger.info(`Token refreshed for user ${token.user.email}`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: TokenService.getTokenExpiry(),
      };
    } catch (error: any) {
      logger.error('Refresh token error:', error);
      throw error;
    }
  }
}
