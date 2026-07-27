/**
 * Token Service
 * Wrapper for JWT token generation and verification
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

export class TokenService {
  private static getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot sign or verify tokens.');
    }
    return secret;
  }

  private static readonly JWT_EXPIRY: string = process.env.JWT_EXPIRY || '1h';
  private static readonly REFRESH_EXPIRY: string = process.env.JWT_REFRESH_EXPIRY || '8h';

  /**
   * Generate access token (JWT)
   */
  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.getJwtSecret(), {
      expiresIn: this.JWT_EXPIRY as any,
    });
  }

  /**
   * Generate refresh token (UUID)
   */
  static generateRefreshToken(): string {
    return uuidv4();
  }

  /**
   * Generate password reset token (UUID)
   */
  static generateResetToken(): string {
    return uuidv4();
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.getJwtSecret()) as TokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Decode JWT token without verification (for debugging)
   */
  static decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get token expiry timestamp
   */
  static getTokenExpiry(expiresIn: string = this.JWT_EXPIRY): number {
    // Convert string like '8h' to seconds
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 8 * 60 * 60; // Default 8 hours
    }
  }

  /**
   * Get refresh token expiry timestamp
   */
  static getRefreshTokenExpiry(): number {
    return this.getTokenExpiry(this.REFRESH_EXPIRY);
  }

  /**
   * Calculate expiry date from duration
   */
  static calculateExpiryDate(duration: string): Date {
    const seconds = this.getTokenExpiry(duration);
    return new Date(Date.now() + seconds * 1000);
  }
}
