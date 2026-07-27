import { useEffect, useRef } from 'react';

/**
 * Debounced sessionStorage snapshot of in-progress form data, so an
 * interrupted staff member (paged away mid-form, tab closed) doesn't lose
 * everything typed since the last explicit save. Deliberately lightweight —
 * not a replacement for real offline-write queuing, just a local safety net
 * for the "lost my typing" complaint.
 */
export function useDraftPersistence<T>(key: string, data: T, enabled: boolean) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch {
        // sessionStorage unavailable/full — draft safety-net is best-effort only
      }
    }, 2000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, JSON.stringify(data)]);

  const restore = (): T | null => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };

  const clear = () => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  };

  return { restore, clear };
}
