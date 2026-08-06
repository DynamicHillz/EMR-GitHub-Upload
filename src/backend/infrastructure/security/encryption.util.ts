/**
 * Symmetric encryption for tenant-stored external-system credentials
 * (currently just Tenant.dhis2Password). No encryption utility existed in
 * this codebase before — the payment-gateway secret columns are plaintext,
 * a known gap this deliberately does not copy for DHIS2's password field.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // recommended IV length for GCM

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('ENCRYPTION_KEY is not set — required to encrypt/decrypt stored credentials');
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte value hex-encoded (64 hex characters)');
  }
  return key;
}

// Stored as "iv:authTag:ciphertext", all hex-encoded, so it fits in a
// single String column with no extra schema needed.
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decrypt(stored: string): string {
  const key = getKey();
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Stored value is not in the expected iv:authTag:ciphertext format');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
  return plaintext.toString('utf8');
}
