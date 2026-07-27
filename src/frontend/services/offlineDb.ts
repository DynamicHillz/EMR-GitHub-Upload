/**
 * Shared IndexedDB connection for offline capability — one database, one
 * `openDB` call, used by both offlineQueue.ts (write queue) and
 * offlineCache.ts (bounded read cache). Two independent openDB() calls
 * against the same database name/version from different modules can race
 * or block each other on upgrade, so this is the single source of truth.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { StoredQueuedWrite } from './offlineQueue';

export interface CachedRecord {
  key: string;
  type: 'PATIENT_CORE' | 'TODAY_APPOINTMENTS';
  // Encrypted at rest (see offlineCache.ts) — this store holds patient
  // demographics/allergies/prescriptions, real PII, on a device that may be
  // shared or lost. `iv`/`ciphertext` replace the old plaintext `data`
  // field; a record from before this change simply won't decrypt and is
  // treated as a cache miss (harmless — it's just opportunistic cache).
  iv: number[];
  ciphertext: number[];
  cachedAt: string;
}

export interface OfflineDB extends DBSchema {
  pendingWrites: {
    key: string;
    // Payload is encrypted at rest (see offlineQueue.ts / offlineCrypto.ts)
    // — this reflects the shape written for new entries. Anything queued
    // before encryption was added is still readable (offlineQueue.ts
    // handles both shapes at the application layer); IndexedDB itself
    // doesn't enforce a value schema, so that's a safe mismatch.
    value: StoredQueuedWrite;
    indexes: { 'by-status': string; 'by-createdAt': string };
  };
  cachedRecords: {
    key: string;
    value: CachedRecord;
    indexes: { 'by-type': string };
  };
  cryptoKeys: {
    key: string;
    value: CryptoKey;
  };
}

const DB_NAME = 'ssmc-emr-offline';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<OfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('pendingWrites')) {
          const writesStore = db.createObjectStore('pendingWrites', { keyPath: 'id' });
          writesStore.createIndex('by-status', 'status');
          writesStore.createIndex('by-createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('cachedRecords')) {
          const cacheStore = db.createObjectStore('cachedRecords', { keyPath: 'key' });
          cacheStore.createIndex('by-type', 'type');
        } else if (oldVersion < 2) {
          // Moving from plaintext `data` to encrypted `iv`/`ciphertext` —
          // old entries can't be decrypted, so just drop them rather than
          // leave unreadable rows around; they're opportunistic cache only.
          db.deleteObjectStore('cachedRecords');
          const cacheStore = db.createObjectStore('cachedRecords', { keyPath: 'key' });
          cacheStore.createIndex('by-type', 'type');
        }
        if (!db.objectStoreNames.contains('cryptoKeys')) {
          db.createObjectStore('cryptoKeys');
        }
      },
    });
  }
  return dbPromise;
}
