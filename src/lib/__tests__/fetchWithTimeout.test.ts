import fs from 'fs';
import path from 'path';
import {
  createFetchWithTimeout,
  DEFAULT_TIMEOUT_MS,
  LONG_TIMEOUT_MS,
  RequestTimeoutError,
  timeoutForUrl,
} from '../fetchWithTimeout';

// A fetch that never answers until its signal aborts — what a stalled
// Android OkHttp request looks like to the app (CT7-068).
const hangingFetch = jest.fn(
  (_input: any, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
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

  it('gives uploads and edge functions the longer limit', () => {
    expect(timeoutForUrl(`${BASE}/rest/v1/leases`)).toBe(DEFAULT_TIMEOUT_MS);
    expect(timeoutForUrl(`${BASE}/auth/v1/user`)).toBe(DEFAULT_TIMEOUT_MS);
    expect(timeoutForUrl(`${BASE}/storage/v1/object/documents/a.pdf`)).toBe(LONG_TIMEOUT_MS);
    expect(timeoutForUrl(`${BASE}/functions/v1/send-push`)).toBe(LONG_TIMEOUT_MS);
  });

  it('the app Supabase client uses it', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../supabase.ts'), 'utf8');
    expect(src).toMatch(/global:\s*\{\s*fetch:\s*createFetchWithTimeout\(\)\s*\}/);
  });
});

describe('inspection report export keeps its error (CT7-068)', () => {
  const screens = ['InspectionScreen.tsx', 'OwnerInspectionDetailScreen.tsx'];
  it.each(screens)('%s reports and logs the export failure', (file) => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../features/inspections/screens', file),
      'utf8'
    );
    const handler = src.slice(src.indexOf('exportInspectionReportPdf(inspection.id'));
    const catchBlock = handler.slice(handler.indexOf('} catch'), handler.indexOf('} finally'));
    expect(catchBlock).toMatch(/catch \(err\)/);
    expect(catchBlock).toMatch(/reportApiError\(err, 'inspections', 'export'\)/);
    expect(catchBlock).toMatch(/console\.error\(/);
  });
});
