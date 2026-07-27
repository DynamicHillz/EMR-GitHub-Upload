import jwt from 'jsonwebtoken';
import { logger } from '../../config/logger';

export interface VerificationPayload {
  type: 'INVOICE' | 'PATIENT';
  id: string;
  hash?: string; // Optional hash of critical data for extra security
  [key: string]: any;
}

export class VerificationService {
  private readonly secretKey: string;

  constructor() {
    // Deliberately a separate secret from JWT_SECRET (which signs short-lived
    // login sessions). These verification tokens are embedded in QR codes on
    // physical documents that leave the building and can live for 10 years —
    // a much longer-lived, physically-distributed artifact than a session
    // token. Sharing one secret across both means any future weakness that
    // helps recover it via the lower-security artifact (a photographed,
    // years-old printed invoice) would compromise live session forgery too.
    // Falls back to JWT_SECRET so an existing deployment that hasn't set the
    // new var yet keeps working unchanged — just logs a warning to prompt
    // setting it.
    if (!process.env.VERIFICATION_TOKEN_SECRET) {
      logger.warn('VERIFICATION_TOKEN_SECRET is not set — falling back to JWT_SECRET for document verification tokens. Set VERIFICATION_TOKEN_SECRET to a separate value in .env.');
    }
    this.secretKey = process.env.VERIFICATION_TOKEN_SECRET || process.env.JWT_SECRET || 'your-secret-key';
  }

  /**
   * Generates a secure token for a document.
   * This token can be embedded in a QR code.
   */
  generateVerificationToken(payload: VerificationPayload): string {
    // We don't want this token to expire quickly so people can scan invoices years later.
    // We'll set a 10 year expiration just as a safeguard.
    return jwt.sign(payload, this.secretKey, { expiresIn: '3650d' });
  }

  /**
   * Verifies the token and returns the payload.
   */
  verifyToken(token: string): VerificationPayload {
    try {
      const decoded = jwt.verify(token, this.secretKey) as VerificationPayload;
      if (!decoded.type || !decoded.id) {
        throw new Error('Invalid token payload');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired verification token');
    }
  }
}

export const verificationService = new VerificationService();
