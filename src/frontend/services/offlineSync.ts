/**
 * Offline Sync — replays queued writes against /api/sync/push once
 * connectivity is confirmed. Triggered on the browser's `online` event,
 * on load, and on a periodic backstop timer (navigator.onLine alone is
 * unreliable — a real reachability check against /health is what actually
 * gates a replay attempt).
 */

import { getPendingWrites, updateWriteStatus, removeWrite, getPendingWriteCount, resumeAuthExpiredWrites } from './offlineQueue';

// Fired on window when a queued write can't be replayed because the token
// expired while offline (the server rejected it with a real 401) — a
// top-level component listens for this to show a re-login prompt (see
// AuthContext.tsx).
export const AUTH_EXPIRED_EVENT = 'offline-sync-auth-expired';

// Distinct from the above: there's no token at all (never logged in this
// session, or logged out — e.g. the 15-minute inactivity auto-logout —
// while writes are still sitting in the queue) rather than a token the
// server actively rejected. Previously this case exited replayQueuedWrites
// silently with no signal whatsoever.
export const NO_TOKEN_EVENT = 'offline-sync-no-token';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`;
const HEALTH_URL = API_BASE_URL.replace(/\/api$/, '') + '/health';
const DEVICE_ID_KEY = 'ssmc-emr-device-id';

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

async function isReachable(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

let deviceRegistered = false;

async function ensureDeviceRegistered(token: string): Promise<void> {
  if (deviceRegistered) return;
  try {
    const res = await fetch(`${API_BASE_URL}/sync/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        deviceName: `${navigator.platform || 'Browser'} — ${navigator.userAgent.split(' ').slice(-1)[0]}`,
        deviceType: 'BROWSER',
      }),
    });
    if (res.ok) deviceRegistered = true;
  } catch {
    // Best-effort — if this fails, the push below will just get a 403 and
    // the writes stay queued for the next attempt rather than being lost.
  }
}

export interface ReplayResult {
  applied: number;
  conflicts: number;
  failed: number;
}

let replayInFlight = false;

export async function replayQueuedWrites(): Promise<ReplayResult> {
  const empty: ReplayResult = { applied: 0, conflicts: 0, failed: 0 };
  if (replayInFlight) return empty;

  const pending = await getPendingWrites();
  if (pending.length === 0) return empty;

  const token = localStorage.getItem('token');
  if (!token) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NO_TOKEN_EVENT, { detail: { count: pending.length } }));
    }
    return empty;
  }

  if (!(await isReachable())) return empty;

  replayInFlight = true;
  try {
    await ensureDeviceRegistered(token);

    const changes = pending.map((w) => ({
      entityType: w.entityType,
      entityId: w.entityId,
      operation: w.operation,
      payload: w.payload,
      baseVersion: w.baseVersion,
    }));

    const res = await fetch(`${API_BASE_URL}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ deviceId: getDeviceId(), changes }),
    });

    const result: ReplayResult = { applied: 0, conflicts: 0, failed: 0 };

    if (res.status === 401) {
      // The token expired while this device was offline — retrying forever
      // against an endpoint that will always 401 just hides the problem.
      // Park these writes distinctly (excluded from the normal PENDING
      // pool) and tell the UI so the user can log back in; a fresh login
      // resumes them via resumeAuthExpiredWrites().
      for (const write of pending) {
        await updateWriteStatus(write.id, 'AUTH_EXPIRED', 'Session expired while offline');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { count: pending.length } }));
      }
      return result;
    }

    if (!res.ok) return result;

    const { data } = await res.json();
    for (let i = 0; i < pending.length; i++) {
      const item = data?.[i];
      const write = pending[i];
      if (!item) continue;

      if (item.status === 'APPLIED') {
        await removeWrite(write.id);
        result.applied++;
      } else if (item.status === 'CONFLICT') {
        await updateWriteStatus(write.id, 'CONFLICT');
        result.conflicts++;
      } else {
        await updateWriteStatus(write.id, 'FAILED', item.message);
        result.failed++;
      }
    }
    return result;
  } finally {
    replayInFlight = false;
  }
}

const BACKSTOP_INTERVAL_MS = 60000;
let initialized = false;

export function initOfflineSync(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener('online', () => {
    replayQueuedWrites();
  });
  setInterval(() => {
    replayQueuedWrites();
  }, BACKSTOP_INTERVAL_MS);
  // Catch anything queued in a previous session that never got a chance to replay.
  replayQueuedWrites();
}

/**
 * Call after a successful login — resumes any writes that were parked as
 * AUTH_EXPIRED during a previous session and immediately attempts to
 * replay them, instead of waiting for the next backstop tick.
 */
export async function resumeSyncAfterLogin(): Promise<void> {
  const resumedCount = await resumeAuthExpiredWrites();
  if (resumedCount > 0) {
    replayQueuedWrites();
  }
}

export { getPendingWriteCount };
