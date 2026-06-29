/**
 * Safely extract a human-readable error message from a caught value.
 *
 * TanStack Query v5 types `error` as `Error | null`, but in practice
 * anything can be thrown. This utility ensures we always return a
 * non-null fallback string regardless of the error shape.
 *
 * @example
 *   error: query.isError ? extractErrorMessage(query.error) : null
 */
export function extractErrorMessage(
  error: unknown,
  fallback = 'An unexpected error occurred'
): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  return fallback;
}
