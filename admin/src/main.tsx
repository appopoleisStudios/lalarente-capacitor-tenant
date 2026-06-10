import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';

const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    release: `admin-panel@${import.meta.env.VITE_APP_VERSION ?? 'dev'}`,
    environment: import.meta.env.MODE,
    integrations: [...(typeof Sentry.browserTracingIntegration === 'function' ? [Sentry.browserTracingIntegration()] : [])],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
