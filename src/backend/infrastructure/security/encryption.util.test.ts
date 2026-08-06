import crypto from 'crypto';
import { encrypt, decrypt } from './encryption.util';

describe('encryption.util', () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('round-trips plaintext through encrypt/decrypt', () => {
    const ciphertext = encrypt('my-dhis2-password');
    expect(decrypt(ciphertext)).toBe('my-dhis2-password');
  });

  it('produces a different ciphertext each time (random IV) for the same plaintext', () => {
    expect(encrypt('same-value')).not.toBe(encrypt('same-value'));
  });

  it('throws when ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('anything')).toThrow('ENCRYPTION_KEY is not set');
  });

  it('throws when ENCRYPTION_KEY is not a 32-byte hex value', () => {
    process.env.ENCRYPTION_KEY = 'too-short';
    expect(() => encrypt('anything')).toThrow('32-byte value');
  });

  it('throws when decrypting a value with a different key than it was encrypted with', () => {
    const ciphertext = encrypt('secret');
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    expect(() => decrypt(ciphertext)).toThrow();
  });
});
