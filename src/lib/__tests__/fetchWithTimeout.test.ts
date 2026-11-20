import fs from 'fs';
import path from 'path';
import {
  createFetchWithTimeout,
  DEFAULT_TIMEOUT_MS,
  LONG_TIMEOUT_MS,
  RequestTimeoutError,
  timeoutFor,
} from '../fetchWithTimeout';

// A fetch that never answers until its signal aborts — what a stalled
// Android OkHttp request looks like to the app (CT7-068).
const hangingFetch = jest.fn(
  (input: any, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal ?? input?.signal;
      if (signal?.aborted) reject(new Error('Aborted'));
      signal?.addEventListener('abort', () => reject(new Error('Aborted')));
    })
) as unknown as typeof fetch;

const BASE = 'https://example.supabase.co';

describe('fetchWithTimeout (CT7-068)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fails a stalled request with a "timed out" error instead of hanging', async () => {
    const f = createFetchWithTimeout(hangingFetch);
    const p = f(`${BASE}/rest/v1/inspections`, {});
    jest.advanceTimersByTime(DEFAULT_TIMEOUT_MS);
    await expect(p).rejects.toBeInstanceOf(RequestTimeoutError);
    await expect(p).rejects.toThrow(/timed out/); // matched by the sign-in "Can't reach" message
  });

  it('does not time out before the limit', async () => {
    const f = createFetchWithTimeout(hangingFetch);
    let settled = false;
    f(`${BASE}/rest/v1/inspections`, {}).catch(() => (settled = true));
    jest.advanceTimersByTime(DEFAULT_TIMEOUT_MS - 1);
    await Promise.resolve();
    expect(settled).toBe(false);
  });

  it('passes a normal response through and clears its timer', async () => {
    const ok = { ok: true } as Response;
    const f = createFetchWithTimeout(jest.fn(async () => ok) as unknown as typeof fetch);
    await expect(f(`${BASE}/rest/v1/x`)).resolves.toBe(ok);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('still honours an abort from the caller, without calling it a timeout', async () => {
    const f = createFetchWithTimeout(hangingFetch);
    const caller = new AbortController();
    const p = f(`${BASE}/rest/v1/x`, { signal: caller.signal });
    caller.abort();
    await expect(p).rejects.toThrow('Aborted');
    await expect(p).rejects.not.toBeInstanceOf(RequestTimeoutError);
  });

  it("honours a Request object's own signal, aborted before or after the call", async () => {
    const f = createFetchWithTimeout(hangingFetch);

    const before = new AbortController();
    before.abort();
    await expect(f(new Request(`${BASE}/rest/v1/x`, { signal: before.signal }))).rejects.toThrow(
      'Aborted'
    );

    const after = new AbortController();
    const p = f(new Request(`${BASE}/rest/v1/x`, { signal: after.signal }));
    after.abort();
    await expect(p).rejects.toThrow('Aborted');
    await expect(p).rejects.not.toBeInstanceOf(RequestTimeoutError);
  });

  it('accepts URL inputs', async () => {
    const f = createFetchWithTimeout(hangingFetch);
    const p = f(new URL(`${BASE}/rest/v1/x`));
    jest.advanceTimersByTime(DEFAULT_TIMEOUT_MS);
    await expect(p).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  it('never cuts off a file upload, however long it takes', async () => {
    let finish!: (r: Response) => void;
    const slowUpload = jest.fn(
      () => new Promise<Response>((resolve) => (finish = resolve))
    ) as unknown as typeof fetch;
    const f = createFetchWithTimeout(slowUpload);
    const ok = { ok: true } as Response;

    const p = f(`${BASE}/storage/v1/object/maintenance-media/u/video.mp4`, {
      method: 'POST',
      body: new ArrayBuffer(8),
    });
    jest.advanceTimersByTime(LONG_TIMEOUT_MS * 5); // a 50 MB video on a slow line
    finish(ok);
    await expect(p).resolves.toBe(ok);
  });

  it('limits: 30 s database/auth, 120 s storage reads and functions, none for uploads', () => {
    expect(timeoutFor(`${BASE}/rest/v1/leases`)).toBe(DEFAULT_TIMEOUT_MS);
    expect(timeoutFor(`${BASE}/auth/v1/user`)).toBe(DEFAULT_TIMEOUT_MS);
    expect(timeoutFor(`${BASE}/storage/v1/object/public/documents/a.pdf`)).toBe(LONG_TIMEOUT_MS);
    expect(timeoutFor(`${BASE}/storage/v1/object/list/documents`, '{"prefix":""}')).toBe(
      LONG_TIMEOUT_MS
    );
    expect(timeoutFor(`${BASE}/functions/v1/send-push`, '{}')).toBe(LONG_TIMEOUT_MS);
    expect(timeoutFor(`${BASE}/storage/v1/object/documents/a.pdf`, new ArrayBuffer(1))).toBeNull();
  });

  it('the app Supabase client uses it', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../supabase.ts'), 'utf8');
    expect(src).toMatch(/global:\s*\{\s*fetch:\s*createFetchWithTimeout\(\)\s*\}/);
  });
});
