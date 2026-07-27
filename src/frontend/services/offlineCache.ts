/**
 * Offline Read Cache
 *
 * Bounded, opportunistic cache of the signed-in user's active worklist —
 * NOT a general offline data layer. Deliberate scope boundary: only
 * today's appointments and the core record (demographics, allergies,
 * active prescriptions) of a patient actually being viewed get cached,
 * refreshed whenever those views load successfully online. Full-database
 * offline read is explicitly out of scope — see the Phase B plan.
 *
 * Encrypted at rest: this cache holds real PII (allergies, prescriptions)
 * on a device that may be shared between staff or lost/stolen. Values are
 * AES-GCM encrypted with a non-extractable key generated once per device
 * and stored in IndexedDB itself — readable only by script running on this
 * origin, not by opening the IndexedDB files directly (devtools, disk
 * access, etc.), since a non-extractable CryptoKey's raw bytes are never
 * exposed to JS, only usable in-place by the Web Crypto API.
 */

import { getOfflineDb } from './offlineDb';
import { encrypt, decrypt } from './offlineCrypto';

export async function cachePatientCore(patientId: string, data: any): Promise<void> {
  const db = await getOfflineDb();
  const { iv, ciphertext } = await encrypt(data);
  await db.put('cachedRecords', {
    key: `PATIENT_CORE:${patientId}`,
    type: 'PATIENT_CORE',
    iv,
    ciphertext,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedPatientCore(patientId: string): Promise<{ data: any; cachedAt: string } | null> {
  const db = await getOfflineDb();
  const record = await db.get('cachedRecords', `PATIENT_CORE:${patientId}`);
  if (!record) return null;
  try {
    const data = await decrypt(record.iv, record.ciphertext);
    return { data, cachedAt: record.cachedAt };
  } catch {
    // Undecryptable (e.g. a pre-encryption entry, or key was reset) —
    // treat as a cache miss rather than surfacing garbage or crashing.
    return null;
  }
}

export async function cacheTodayAppointments(data: any[]): Promise<void> {
  const db = await getOfflineDb();
  const { iv, ciphertext } = await encrypt(data);
  await db.put('cachedRecords', {
    key: 'TODAY_APPOINTMENTS',
    type: 'TODAY_APPOINTMENTS',
    iv,
    ciphertext,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedTodayAppointments(): Promise<{ data: any[]; cachedAt: string } | null> {
  const db = await getOfflineDb();
  const record = await db.get('cachedRecords', 'TODAY_APPOINTMENTS');
  if (!record) return null;
  try {
    const data = await decrypt(record.iv, record.ciphertext);
    return { data, cachedAt: record.cachedAt };
  } catch {
    return null;
  }
}
