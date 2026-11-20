// CT7-068: React Native's Android fetch (OkHttp) has no timeout, so a request
// that stalls mid-flight spins forever (stuck spinners) or fails late with a
// generic error. Every Supabase request goes through this wrapper so a stalled
// one fails with a clear "timed out" error the screens already handle.

/** Database, auth and RPC calls. */
export const DEFAULT_TIMEOUT_MS = 30_000;
/** File uploads/downloads and edge functions legitimately take longer. */
export const LONG_TIMEOUT_MS = 120_000;

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${Math.round(ms / 1000)}s`);
    this.name = 'RequestTimeoutError';
  }
}

export function timeoutForUrl(url: string): number {
  return url.includes('/storage/v1/') || url.includes('/functions/v1/')
    ? LONG_TIMEOUT_MS
    : DEFAULT_TIMEOUT_MS;
}

export function createFetchWithTimeout(
  baseFetch: typeof fetch = fetch,
  getTimeout: (url: string) => number = timeoutForUrl
): typeof fetch {
  return (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const ms = getTimeout(url);
    const controller = new AbortController();
    let timedOut = false;

    // Keep honouring an abort the caller asked for (supabase-js passes signals).
    const callerSignal = init?.signal;
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
