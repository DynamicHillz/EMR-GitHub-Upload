/**
 * Sentry Error Monitoring (Frontend)
 *
 * No-ops safely if VITE_SENTRY_DSN isn't set — nothing breaks in an
 * environment that hasn't configured it yet.
 */
import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
    // Session replay/PII capture stays off — patient data must not leave
    // this machine via error reports.
    sendDefaultPii: false,
  });
}

export { Sentry };
