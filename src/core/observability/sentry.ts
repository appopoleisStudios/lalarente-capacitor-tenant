import * as Sentry from '@sentry/react-native';
import { env } from '../config/env';

/**
 * Report an API-layer error to Sentry with Supabase context breadcrumb.
 * Never includes row contents — POPIA compliance.
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

  Sentry.captureException(error);
}
