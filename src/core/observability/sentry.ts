import * as Sentry from '@sentry/react-native';
import { env } from '../config/env';

// Fixed descriptions for known safe Postgres SQLSTATE codes.
// Map (not plain object) to avoid prototype-property pollution:
// Object literal lookups inherit from Object.prototype, so keys like
// "constructor" or "__proto__" return truthy values on a plain object.
const SAFE_PG_CODE_DESCRIPTIONS = new Map<string, string>([
  ['08006', 'connection failure'],
  ['28000', 'invalid authorization'],
  ['42501', 'insufficient privilege'],
  ['23502', 'not null violation'],
  ['23503', 'foreign key violation'],
  ['23505', 'unique violation'],
  ['23514', 'check violation'],
  ['53100', 'disk full'],
  ['57014', 'query canceled'],
]);

interface SupabaseError {
  code?: string;
  message?: string;
  hint?: string;
  details?: string;
}

// Allowlist of safe error name values. Any custom name (e.g. 'tenant@example.com')
// is normalized to 'Error' before forwarding to Sentry.
const SAFE_ERROR_NAMES = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'DatabaseError',
  'NetworkError',
  'AuthError',
  'StorageError',
]);

// Rebuild a stack string from genuine frame lines only.
// Skips the first line (always the message prefix) then keeps lines matching:
//   - V8 without @: "  at Something (file.js:10:5)" or "  at file.js:10:5"
//   - V8 with @ in name: requires source in parens "  at A.b (file.js:10:5)"
//     (guards against crafted "  at email@domain.com:1:5" injection)
//   - Hermes/JSC: "FunctionName@file.js:10:5" (no leading whitespace)
function replaceStackMessage(stack: string | undefined, safeMessage: string): string {
  if (!stack) return `Error: ${safeMessage}`;
  const frameLines = stack
    .split('\n')
    .slice(1) // drop the first line ("ErrorName: message")
    .filter((line) => {
      if (/^\s+at\s/.test(line)) {
        // V8 frame: if the content contains "@", require the source location
        // to be wrapped in parens with no "@" inside them — genuine V8 file
        // paths never contain "@", but crafted injections like
        // "  at lookup (tenant@example.com:1:5)" do.
        if (/@/.test(line)) return /\([^@]*:\d+:\d+\)/.test(line);
        return /:\d+:\d+/.test(line);
      }
      // Hermes/JSC: "name@file:line:col" — must NOT start with whitespace.
      return /^[^\s][^@]*@.+:\d+:\d+/.test(line);
    });
  return frameLines.length
    ? `Error: ${safeMessage}\n${frameLines.join('\n')}`
    : `Error: ${safeMessage}`;
}

function safeName(name: string): string {
  return SAFE_ERROR_NAMES.has(name) ? name : 'Error';
}

function safeCodeMessage(code: string): string {
  const desc = SAFE_PG_CODE_DESCRIPTIONS.get(code);
  // Unknown codes are not forwarded — they could contain arbitrary caller-supplied text.
  return desc ? `${code}: ${desc}` : 'unknown database error';
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
      sanitized.name = safeName(error.name);
      sanitized.stack = replaceStackMessage(error.stack, safeMessage);
      return sanitized;
    }
    const sanitized = new Error('API error');
    sanitized.name = safeName(error.name);
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
// Strip source-location parens from each React component stack line.
// Keeps component names (safe identifiers) while removing file:line:col
// references that could contain PII-laden bundle paths or query params.
export function sanitizeComponentStack(componentStack: string | null | undefined): string {
  if (!componentStack) return '';
  return componentStack
    .split('\n')
    .map((line) => line.replace(/\s*\([^)]*\)\s*$/, '').trimEnd())
    .join('\n');
}

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
