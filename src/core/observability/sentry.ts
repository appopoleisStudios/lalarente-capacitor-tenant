import * as Sentry from '@sentry/react-native';
import { env } from '../config/env';

// Fixed descriptions for known safe Postgres SQLSTATE codes.
// Using fixed strings (not sb.message) so a custom exception with an
// allowlisted code cannot smuggle arbitrary message text into Sentry.
const SAFE_PG_CODE_DESCRIPTIONS: Record<string, string> = {
  '08006': 'connection failure',
  '28000': 'invalid authorization',
  '42501': 'insufficient privilege',
  '23502': 'not null violation',
  '23503': 'foreign key violation',
  '23505': 'unique violation',
  '23514': 'check violation',
  '53100': 'disk full',
  '57014': 'query canceled',
};

interface SupabaseError {
  code?: string;
  message?: string;
  hint?: string;
  details?: string;
}

// Replace the first line of a stack trace ("ErrorName: original message")
// with a safe message so that PII in the original message does not appear in
// the stack string forwarded to Sentry.
function replaceStackMessage(stack: string | undefined, safeMessage: string): string {
  if (!stack) return `Error: ${safeMessage}`;
  const newline = stack.indexOf('\n');
  if (newline === -1) return `Error: ${safeMessage}`;
  return `Error: ${safeMessage}${stack.slice(newline)}`;
}

function safeCodeMessage(code: string): string {
  const desc = SAFE_PG_CODE_DESCRIPTIONS[code];
  return desc ? `${code}: ${desc}` : code; // unknown codes: emit code only, no message
}

export function sanitizeForSentry(error: unknown): Error {
  // instanceof Error is checked first so a JS Error that also carries a .code
  // property (e.g. some Supabase client wrappers) keeps its original stack
  // instead of being treated as a plain structured object and losing frames.
  if (error instanceof Error) {
    const coded = error as Error & { code?: unknown };
    if (typeof coded.code === 'string') {
      const safeMessage = safeCodeMessage(coded.code);
      const sanitized = new Error(safeMessage);
      sanitized.name = error.name;
      sanitized.stack = replaceStackMessage(error.stack, safeMessage);
      return sanitized;
    }
    const sanitized = new Error('API error');
    sanitized.name = error.name;
    sanitized.stack = replaceStackMessage(error.stack, 'API error');
    return sanitized;
  }

  // Plain Supabase / PostgREST structured error object (not an Error instance).
  if (error !== null && typeof error === 'object' && !Array.isArray(error)) {
    const sb = error as SupabaseError;
    if (typeof sb.code === 'string') {
      return new Error(safeCodeMessage(sb.code));
    }
  }

  return new Error('unknown API error');
}

/**
 * Report an API-layer error to Sentry with Supabase context breadcrumb.
 *
 * Sanitization strategy (POPIA compliance):
 * - JS Error with .code: fixed description per SQLSTATE; stack message line replaced.
 * - Plain Error: message replaced with 'API error'; stack message line replaced.
 * - Supabase plain object: fixed description per SQLSTATE code, no message forwarded.
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
