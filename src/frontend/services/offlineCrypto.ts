/**
 * Shared AES-GCM encrypt/decrypt for data kept at rest offline — used by
 * both the bounded read cache (offlineCache.ts) and the write queue
 * (offlineQueue.ts). One non-extractable per-device key, generated once and
 * stored in offlineDb.ts's `cryptoKeys` store, so both modules protect PII
 * the same way instead of duplicating (or worse, diverging) the crypto
 * logic.
 */

import { getOfflineDb } from './offlineDb';

const KEY_STORE_KEY = 'device-key';

export async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  const db = await getOfflineDb();
  const existing = await db.get('cryptoKeys', KEY_STORE_KEY);
  if (existing) return existing;

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await db.put('cryptoKeys', key, KEY_STORE_KEY);
  return key;
}

export async function encrypt(data: any): Promise<{ iv: number[]; ciphertext: number[] }> {
  const key = await getOrCreateDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(encrypted)) };
}

export async function decrypt(iv: number[], ciphertext: number[]): Promise<any> {
  const key = await getOrCreateDeviceKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    new Uint8Array(ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}
