/**
 * Offline Write Queue
 *
 * IndexedDB-backed queue for mutating requests that fail because the
 * device has no connection. A queued write survives a page reload/crash
 * (IndexedDB persists to disk) and gets replayed against /api/sync/push
 * once connectivity returns (see offlineSync.ts).
 *
 * Scope: only entities the backend's sync push endpoint can actually
 * replay — UPDATE for PATIENT, CONSULTATION, APPOINTMENT, INVOICE, and
 * CREATE for TRIAGE and PATIENT (see sync.controller.ts). Queueing writes
 * for other entities/operations would just fail on replay, so callers
 * should only route those through this queue.
 *
 * Idempotency: for UPDATE, the entity's own `version` column (sent as
 * `baseVersion`) is what makes a replay safe — the server rejects a stale
 * base version instead of double-applying it. For CREATE, the client
 * generates the entity's id up front (see queueWrite's `entityId` param)
 * and the server checks for an existing row with that id before creating —
 * a replay of an already-applied create is a safe no-op, not a duplicate.
 *
 * Encrypted at rest: a queued write's payload routinely contains real PII
 * (patient name/DOB/phone/address/allergies, triage chief complaint and
 * vitals) and can sit here for a while if a write is stuck FAILED/CONFLICT.
 * Same threat model as the read cache in offlineCache.ts (a device that may
 * be shared between staff or lost/stolen), so it gets the same AES-GCM
 * encryption via the shared device key in offlineCrypto.ts. Reads fall back
 * to a plain `payload` field for any write queued before this change —
 * unlike the read cache (purely opportunistic, safe to drop), a queued
 * write can be real not-yet-synced clinical data, so old entries are read
 * as-is rather than discarded.
 */

import { getOfflineDb } from './offlineDb';
import { encrypt, decrypt } from './offlineCrypto';

export type QueuedEntityType = 'PATIENT' | 'CONSULTATION' | 'APPOINTMENT' | 'INVOICE' | 'TRIAGE';
export type QueuedOperation = 'CREATE' | 'UPDATE';
export type QueuedWriteStatus = 'PENDING' | 'SYNCING' | 'CONFLICT' | 'FAILED' | 'AUTH_EXPIRED';

// Public shape — payload is always a decrypted plain object here, regardless
// of how (or whether) it's encrypted at rest.
export interface QueuedWrite {
  id: string; // client-generated queue-entry id (not the entity id)
  entityType: QueuedEntityType;
  entityId: string; // for CREATE, this is the entity's own id, chosen client-side
  operation: QueuedOperation;
  payload: Record<string, any>;
  baseVersion?: number;
  createdAt: string;
  status: QueuedWriteStatus;
  errorMessage?: string;
}

// What's actually persisted to IndexedDB — payload replaced by its
// encrypted form. `StoredQueuedWriteLegacy` (payload in the clear) is kept
// readable for anything queued before encryption was added.
export interface StoredQueuedWrite extends Omit<QueuedWrite, 'payload'> {
  iv: number[];
  ciphertext: number[];
}
type StoredQueuedWriteLegacy = QueuedWrite;
type StoredQueuedWriteRecord = StoredQueuedWrite | StoredQueuedWriteLegacy;

const getDb = getOfflineDb;

const genId = () =>
  (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

async function toPublic(record: StoredQueuedWriteRecord): Promise<QueuedWrite> {
  if ('ciphertext' in record) {
    try {
      const payload = await decrypt(record.iv, record.ciphertext);
      const { iv, ciphertext, ...rest } = record;
      return { ...rest, payload };
    } catch (err) {
      // Should be effectively impossible — the key lives in the same
      // IndexedDB database as the ciphertext it protects, so they always
      // rise/fall together (see offlineDb.ts). Surface as a failed write
      // with an empty payload rather than crashing the whole queue read.
      console.error('Failed to decrypt queued write — treating as failed:', record.id, err);
      const { iv, ciphertext, ...rest } = record;
      return { ...rest, payload: {}, status: 'FAILED', errorMessage: 'Could not decrypt this queued write' };
    }
  }
  // Legacy plaintext record from before encryption was added.
  return record;
}

export async function queueWrite(
  entityType: QueuedEntityType,
  entityId: string,
  payload: Record<string, any>,
  baseVersion?: number,
  operation: QueuedOperation = 'UPDATE'
): Promise<QueuedWrite> {
  const db = await getDb();
  const write: QueuedWrite = {
    id: genId(),
    entityType,
    entityId,
    operation,
    payload,
    baseVersion,
    createdAt: new Date().toISOString(),
    status: 'PENDING',
  };
  const { payload: _payload, ...rest } = write;
  const { iv, ciphertext } = await encrypt(payload);
  await db.put('pendingWrites', { ...rest, iv, ciphertext } as any);
  return write;
}

export async function getPendingWrites(): Promise<QueuedWrite[]> {
  const db = await getDb();
  const all = (await db.getAllFromIndex('pendingWrites', 'by-createdAt')) as unknown as StoredQueuedWriteRecord[];
  const filtered = all.filter((w) => w.status === 'PENDING' || w.status === 'FAILED');
  return Promise.all(filtered.map(toPublic));
}

export async function getPendingWriteCount(): Promise<number> {
  return (await getPendingWrites()).length;
}

export async function updateWriteStatus(id: string, status: QueuedWriteStatus, errorMessage?: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get('pendingWrites', id);
  if (!existing) return;
  await db.put('pendingWrites', { ...existing, status, errorMessage } as any);
}

export async function removeWrite(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('pendingWrites', id);
}

export async function getAllQueuedWrites(): Promise<QueuedWrite[]> {
  const db = await getDb();
  const all = (await db.getAllFromIndex('pendingWrites', 'by-createdAt')) as unknown as StoredQueuedWriteRecord[];
  return Promise.all(all.map(toPublic));
}

/**
 * Called after a fresh login — writes that were parked as AUTH_EXPIRED
 * while the previous session's token couldn't be validated are put back
 * into the normal PENDING pool so the next replay picks them up again.
 */
export async function resumeAuthExpiredWrites(): Promise<number> {
  const db = await getDb();
  const all = await db.getAllFromIndex('pendingWrites', 'by-createdAt');
  const expired = all.filter((w) => w.status === 'AUTH_EXPIRED');
  for (const w of expired) {
    await db.put('pendingWrites', { ...w, status: 'PENDING', errorMessage: undefined } as any);
  }
  return expired.length;
}
