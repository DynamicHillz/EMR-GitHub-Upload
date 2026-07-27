/**
 * offlineFetch — a drop-in fetch() replacement for the four mutation call
 * sites (patient/consultation/appointment/invoice update) that the
 * backend's sync push endpoint can actually replay.
 *
 * On success (even a non-2xx HTTP response — that's a real server
 * rejection, e.g. validation error, and should surface normally) this
 * behaves exactly like fetch(). Only an actual network failure (no
 * response at all) gets queued instead of thrown, so the caller's
 * existing try/catch success path doesn't need to change — it just also
 * needs to check `data.queued` if it wants to show a distinct message.
 */

import { queueWrite, QueuedEntityType, QueuedOperation } from './offlineQueue';

export interface OfflineFetchMeta {
  entityType: QueuedEntityType;
  entityId: string;
  baseVersion?: number;
  operation?: QueuedOperation; // defaults to UPDATE
}

export async function offlineFetch(url: string, options: RequestInit, meta: OfflineFetchMeta): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (networkError) {
    // fetch() only throws for actual network failures (offline, DNS,
    // connection refused) — HTTP error statuses resolve normally above.
    let payload: Record<string, any> = {};
    try {
      payload = options.body ? JSON.parse(options.body as string) : {};
    } catch {
      // non-JSON body — nothing sensible to queue, fall through to the throw below
      throw networkError;
    }

    await queueWrite(meta.entityType, meta.entityId, payload, meta.baseVersion, meta.operation || 'UPDATE');

    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        message: 'Saved offline — will sync automatically when your connection returns.',
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
