import * as Sentry from '@sentry/react-native';
import { env } from '../config/env';

function sanitizeError(error: unknown): Error {
  if (error instanceof Error) {
    // Strip anything after a colon-space to drop Postgres detail/hint/value echoes.
    const safeMessage = error.message.replace(/:\s.*/s, '');
    const sanitized = new Error(safeMessage);
    sanitized.name = error.name;
    return sanitized;
  }
  return new Error('unknown error');
}

/**
 * Report an API-layer error to Sentry with Supabase context breadcrumb.
 * Sanitizes the error message to avoid forwarding Postgres row details
 * or query values — POPIA compliance.
 *
 * Usage: reportApiError(err, 'properties', 'select')
 */
export function reportApiError(
  error: unknown,
  table: string,
  operation: 'select' | 'insert' | 'update' | 'delete' | 'rpc' | string
): void {
  if (!env.sentry.dsn) return;

  Sentry.addBreadcrumb({
    category: 'supabase',
    message: `${operation} ${table}`,
    level: 'error',
    data: { table, operation },
  });

  Sentry.captureException(sanitizeError(error));
}
