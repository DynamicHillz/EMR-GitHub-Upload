import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { initOfflineSync } from './services/offlineSync';
import { initSentry, Sentry } from './config/sentry';
import './index.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';

initSentry();

// Precaches the app shell so it can load with no connection. API calls are
// untouched by this — they're handled by the offline write queue below.
registerSW({ immediate: true });

// Replays any queued offline writes once connectivity is confirmed, and on
// a periodic backstop timer (see offlineSync.ts for why navigator.onLine
// alone isn't trusted).
initOfflineSync();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong. Please refresh the page.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
