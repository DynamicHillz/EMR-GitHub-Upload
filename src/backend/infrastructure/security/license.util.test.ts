/**
 * License Util Tests
 *
 * A license is an RS256-signed JWT (see LICENSING.md) verified against
 * config/license-public-key.pem. Uses a throwaway test keypair (not the
 * real deployed key) — fs.readFileSync is mocked to hand back the test
 * public key so this suite never touches the real file or depends on it
 * existing on the machine running the tests.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const { publicKey: testPublicKey, privateKey: testPrivateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const { privateKey: wrongPrivateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(() => testPublicKey),
}));

import { verifyLicenseToken, deriveLicenseStatus } from './license.util';

function signToken(claims: Record<string, any>, key = testPrivateKey) {
  return jwt.sign(claims, key, { algorithm: 'RS256' });
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

describe('verifyLicenseToken', () => {
  it('returns the claims for a validly signed token', () => {
    const token = signToken({ clinicName: 'Test Clinic', licenseIssuedAt: '2026-01-01', maintenanceExpiresAt: daysFromNow(30) });
    const claims = verifyLicenseToken(token);
    expect(claims).toEqual({ clinicName: 'Test Clinic', licenseIssuedAt: '2026-01-01', maintenanceExpiresAt: daysFromNow(30) });
  });

  it('returns null for a token signed with the wrong private key (forged)', () => {
    const token = signToken({ clinicName: 'Test Clinic', licenseIssuedAt: '2026-01-01', maintenanceExpiresAt: daysFromNow(30) }, wrongPrivateKey);
    expect(verifyLicenseToken(token)).toBeNull();
  });

  it('returns null for a malformed token string', () => {
    expect(verifyLicenseToken('not-a-real-token')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(verifyLicenseToken(null)).toBeNull();
    expect(verifyLicenseToken(undefined)).toBeNull();
  });

  it('returns null when required claims are missing from an otherwise validly signed token', () => {
    const token = signToken({ clinicName: 'Test Clinic' }); // missing date claims
    expect(verifyLicenseToken(token)).toBeNull();
  });
});

describe('deriveLicenseStatus', () => {
  it('reports MISSING when no token was ever set', () => {
    expect(deriveLicenseStatus(null)).toEqual({ status: 'MISSING', claims: null, daysRemaining: null });
  });

  it('reports INVALID for a token that fails verification (distinct from MISSING)', () => {
    const result = deriveLicenseStatus('garbage-token');
    expect(result.status).toBe('INVALID');
    expect(result.claims).toBeNull();
  });

  it('reports ACTIVE with the correct days-remaining count before maintenanceExpiresAt', () => {
    const token = signToken({ clinicName: 'Test Clinic', licenseIssuedAt: '2026-01-01', maintenanceExpiresAt: daysFromNow(10) });
    const result = deriveLicenseStatus(token);
    expect(result.status).toBe('ACTIVE');
    expect(result.daysRemaining).toBeGreaterThanOrEqual(9);
    expect(result.daysRemaining).toBeLessThanOrEqual(10);
  });

  it('reports GRACE within 30 days past maintenanceExpiresAt', () => {
    const token = signToken({ clinicName: 'Test Clinic', licenseIssuedAt: '2026-01-01', maintenanceExpiresAt: daysFromNow(-10) });
    const result = deriveLicenseStatus(token);
    expect(result.status).toBe('GRACE');
    expect(result.daysRemaining).toBeLessThan(0);
  });

  it('reports EXPIRED more than 30 days past maintenanceExpiresAt', () => {
    const token = signToken({ clinicName: 'Test Clinic', licenseIssuedAt: '2026-01-01', maintenanceExpiresAt: daysFromNow(-45) });
    const result = deriveLicenseStatus(token);
    expect(result.status).toBe('EXPIRED');
  });
});
