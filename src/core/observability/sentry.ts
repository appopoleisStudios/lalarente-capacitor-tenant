import * as Sentry from '@sentry/react-native';
import { env } from '../config/env';

// Postgres error codes that carry no row-level data in their messages.
// Others may contain column values, constraint details, or rejected inputs.
const SAFE_PG_CODES = new Set([
  '08006', // connection_failure
  '28000', // invalid_authorization_specification
  '42501', // insufficient_privilege
  '23502', // not_null_violation — message is "column X of relation Y"
  '23503', // foreign_key_violation — message is constraint name
  '23505', // unique_violation — message is constraint name
  '23514', // check_violation — message is constraint name
  '53100', // disk_full
  '57014', // query_canceled
]);

interface SupabaseError {
  code?: string;
  message?: string;
  hint?: string;
  details?: string;
}

export function sanitizeForSentry(error: unknown): Error {
  // Supabase / PostgREST structured error — use allowlisted codes only.
  if (error !== null && typeof error === 'object' && !Array.isArray(error)) {
    const sb = error as SupabaseError;
    if (typeof sb.code === 'string') {
      const safeMessage = SAFE_PG_CODES.has(sb.code)
        ? `${sb.code}: ${sb.message ?? 'supabase error'}`
        : sb.code; // drop message entirely for unknown codes
      return new Error(safeMessage);
    }
  }

  if (error instanceof Error) {
    // Preserve the original stack (diagnostic frames) while replacing the
    // message with a safe token. Creating a new Error loses the stack;
    // copying it here keeps Sentry's grouping accurate.
    const sanitized = new Error('API error');
    sanitized.name = error.name;
    sanitized.stack = error.stack;
    return sanitized;
  }

  return new Error('unknown API error');
}

/**
 * Report an API-layer error to Sentry with Supabase context breadcrumb.
 *
 * Sanitization strategy (POPIA compliance):
 * - Supabase/Postgres structured errors: allowlisted codes only; unknown codes
 *   emit only the code token, dropping any message that may contain row values.
 * - Plain Error objects: stack is preserved for grouping; message is replaced
 *   with a generic token so user data in messages is not forwarded.
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

  Sentry.captureException(sanitizeForSentry(error));
}
