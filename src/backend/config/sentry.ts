/**
 * Sentry Error Monitoring (Backend)
 *
 * Must be initialized before anything else imports/uses Express so Sentry's
 * automatic instrumentation can hook in. No-ops safely if SENTRY_DSN isn't
 * set — nothing breaks in an environment that hasn't configured it yet.
 */
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  // Never send request bodies/PII to Sentry — patient data must not leave
  // this machine. Sentry still captures the error message, stack trace,
  // route, and status code via setupExpressErrorHandler in server.ts.
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
    }
    return event;
  },
});

export { Sentry };
