/**
 * License verification — on-premise licensing model (implementation fee +
 * license + annual maintenance, not a cloud subscription; see LICENSING.md).
 *
 * A license "file" is just an RS256-signed JWT. The private half never
 * ships with the app (kept offline by the vendor — see
 * scripts/generate-license.ts); only the public half
 * (config/license-public-key.pem) is committed, since it can verify a
 * signature but never forge one.
 *
 * Deliberately soft-fail everywhere: a bad/missing key file or an
 * unverifiable token must degrade to "license invalid," never crash the
 * server or block a request — confirmed product decision that no clinical
 * feature is ever gated on licensing.
 */

import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { logger } from '../../config/logger';

export interface LicenseClaims {
  clinicName: string;
  licenseIssuedAt: string; // ISO date
  maintenanceExpiresAt: string; // ISO date
}

export type LicenseStatus = 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'MISSING' | 'INVALID';

const GRACE_PERIOD_DAYS = 30;
const PUBLIC_KEY_PATH = path.join(__dirname, '../../../../config/license-public-key.pem');

let cachedPublicKey: string | null | undefined; // undefined = not yet loaded, null = load failed

function loadPublicKey(): string | null {
  if (cachedPublicKey !== undefined) return cachedPublicKey;
  try {
    cachedPublicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
  } catch (err) {
    logger.error(`License public key not found/readable at ${PUBLIC_KEY_PATH} — all licenses will read as INVALID:`, err);
    cachedPublicKey = null;
  }
  return cachedPublicKey;
}

/**
 * Verify a license token's signature and shape. Never throws — a
 * missing/unreadable public key, a malformed token, or a failed signature
 * check all just resolve to `null` (treated as INVALID by
 * deriveLicenseStatus below).
 */
export function verifyLicenseToken(token: string | null | undefined): LicenseClaims | null {
  if (!token) return null;

  const publicKey = loadPublicKey();
  if (!publicKey) return null;

  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as Record<string, unknown>;
    if (
      typeof decoded.clinicName !== 'string' ||
      typeof decoded.licenseIssuedAt !== 'string' ||
      typeof decoded.maintenanceExpiresAt !== 'string'
    ) {
      return null;
    }
    return {
      clinicName: decoded.clinicName,
      licenseIssuedAt: decoded.licenseIssuedAt,
      maintenanceExpiresAt: decoded.maintenanceExpiresAt,
    };
  } catch (err) {
    // Expired/tampered/malformed — all the same to the caller: no usable claims.
    return null;
  }
}

export interface LicenseStatusResult {
  status: LicenseStatus;
  claims: LicenseClaims | null;
  daysRemaining: number | null; // relative to maintenanceExpiresAt; negative once past it
}

/**
 * Derive a display-ready status from a token (already run through
 * verifyLicenseToken) and whether a token was ever set at all — needed to
 * distinguish MISSING (never licensed) from INVALID (licensed once, but the
 * stored token no longer verifies, e.g. tampered).
 */
export function deriveLicenseStatus(token: string | null | undefined): LicenseStatusResult {
  if (!token) {
    return { status: 'MISSING', claims: null, daysRemaining: null };
  }

  const claims = verifyLicenseToken(token);
  if (!claims) {
    return { status: 'INVALID', claims: null, daysRemaining: null };
  }

  const expiresAt = new Date(claims.maintenanceExpiresAt).getTime();
  const now = Date.now();
  const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

  let status: LicenseStatus;
  if (daysRemaining >= 0) {
    status = 'ACTIVE';
  } else if (daysRemaining >= -GRACE_PERIOD_DAYS) {
    status = 'GRACE';
  } else {
    status = 'EXPIRED';
  }

  return { status, claims, daysRemaining };
}
