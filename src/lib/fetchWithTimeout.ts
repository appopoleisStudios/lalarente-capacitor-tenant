// CT7-068: React Native's Android fetch (OkHttp) has no timeout, so a request
// that stalls mid-flight spins forever (stuck spinners) or fails late with a
// generic error. Every Supabase request goes through this wrapper so a stalled
// one fails with a clear "timed out" error the screens already handle.

/** Database, auth and RPC calls. */
export const DEFAULT_TIMEOUT_MS = 30_000;
/** Storage reads/lists/signing and edge functions legitimately take longer. */
export const LONG_TIMEOUT_MS = 120_000;

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${Math.round(ms / 1000)}s`);
    this.name = 'RequestTimeoutError';
  }
}

/**
 * Time limit for a request, or null for none. File uploads (a binary body sent
 * to storage) have no limit: fetch reports no progress, so a slow but healthy
 * upload (maintenance videos go up to 50 MB) can't be told from a stalled one.
 */
export function timeoutFor(url: string, body?: unknown): number | null {
  if (url.includes('/storage/v1/object/') && body != null && typeof body !== 'string') {
    return null;
  }
  return url.includes('/storage/v1/') || url.includes('/functions/v1/')
    ? LONG_TIMEOUT_MS
    : DEFAULT_TIMEOUT_MS;
}

type FetchInput = Parameters<typeof fetch>[0];

const isRequest = (input: FetchInput): input is Request =>
  typeof input === 'object' && input !== null && !(input instanceof URL) && 'url' in input;

export function createFetchWithTimeout(
  baseFetch: typeof fetch = fetch,
  getTimeout: (url: string, body?: unknown) => number | null = timeoutFor
): typeof fetch {
  return (input, init) => {
    const url = typeof input === 'string' ? input : isRequest(input) ? input.url : input.href;
    // The body may come in init or inside a Request. A Request's body can't be
    // inspected cheaply, so a POST/PUT Request counts as a (binary) upload.
    const requestHasBody =
      isRequest(input) && ['POST', 'PUT'].includes((input.method || '').toUpperCase());
    const body = init?.body != null ? init.body : requestHasBody ? input : undefined;
    const ms = getTimeout(url, body);
    if (ms == null) return baseFetch(input, init);

    const controller = new AbortController();
    let timedOut = false;

    // Keep honouring the caller's abort signal: an init.signal (or explicit
    // null) wins, otherwise the Request's own signal, as native fetch does.
    const callerSignal =
      init?.signal !== undefined ? init.signal : isRequest(input) ? input.signal : undefined;
    const onCallerAbort = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener('abort', onCallerAbort);
    }

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ms);

    return baseFetch(input, { ...init, signal: controller.signal })
      .catch((err) => {
        throw timedOut ? new RequestTimeoutError(ms) : err;
      })
      .finally(() => {
        clearTimeout(timer);
        callerSignal?.removeEventListener('abort', onCallerAbort);
      });
  };
}
