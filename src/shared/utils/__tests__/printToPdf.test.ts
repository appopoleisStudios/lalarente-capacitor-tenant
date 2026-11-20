// CT7-068: the Android WebView print step fails now and then (ERR_PDF_WRITE)
// or never calls back. Report exports must retry failures and never hang.
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { sanitizeForSentry } from '@/src/core/observability/sentry';
import {
  printHtmlToFile,
  PrintTimeoutError,
  PRINT_ATTEMPTS,
  PRINT_TIMEOUT_MS,
  PRINT_RETRY_DELAY_MS,
  resetPrinterWarmUpForTests,
  warmUpPrinter,
} from '../printToPdf';

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('@/src/core/config/env', () => ({ env: { sentry: { dsn: '' } } }));

const print = Print.printToFileAsync as jest.Mock;
const deleteAsync = FileSystem.deleteAsync as jest.Mock;

// What expo-print rejects with when Chromium reports "Printing failed."
const pdfWriteError = () =>
  Object.assign(new Error('An error occured while writing the PDF data'), {
    code: 'ERR_PDF_WRITE',
  });

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('printHtmlToFile (CT7-068)', () => {
  beforeEach(() => {
    print.mockReset();
    deleteAsync.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('retries a failed WebView print after a pause and returns the file', async () => {
    jest.useFakeTimers();
    print.mockRejectedValueOnce(pdfWriteError()).mockResolvedValueOnce({ uri: 'file:///r.pdf' });
    const p = printHtmlToFile('<p/>');
    await jest.advanceTimersByTimeAsync(PRINT_RETRY_DELAY_MS - 1);
    expect(print).toHaveBeenCalledTimes(1); // not straight away
    await jest.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBe('file:///r.pdf');
    expect(print).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last attempt with the real error', async () => {
    jest.useFakeTimers();
    print.mockRejectedValue(pdfWriteError());
    const p = printHtmlToFile('<p/>').catch((e) => e);
    await jest.advanceTimersByTimeAsync(PRINT_RETRY_DELAY_MS * 10);
    const err = await p;
    expect(print).toHaveBeenCalledTimes(PRINT_ATTEMPTS);
    expect(err.code).toBe('ERR_PDF_WRITE');
  });

  it('device sequence after app start: stuck, failed, failed, then saved', async () => {
    jest.useFakeTimers();
    print
      .mockReturnValueOnce(new Promise(() => {}))
      .mockRejectedValueOnce(pdfWriteError())
      .mockRejectedValueOnce(pdfWriteError())
      .mockResolvedValueOnce({ uri: 'file:///r.pdf' });
    const p = printHtmlToFile('<p/>');
    await jest.advanceTimersByTimeAsync(PRINT_TIMEOUT_MS + PRINT_RETRY_DELAY_MS * 10);
    await expect(p).resolves.toBe('file:///r.pdf');
  });

  it('CT7-069: the stuck first print after app start is retried once and the export saves', async () => {
    jest.useFakeTimers();
    print
      .mockReturnValueOnce(new Promise(() => {})) // first print in a fresh process: never answers
      .mockResolvedValueOnce({ uri: 'file:///r.pdf' });
    const p = printHtmlToFile('<p/>');
    await jest.advanceTimersByTimeAsync(PRINT_TIMEOUT_MS);
    await expect(p).resolves.toBe('file:///r.pdf');
    expect(print).toHaveBeenCalledTimes(2);
  });

  it('a second stuck print ends the export: at most one abandoned render per tap', async () => {
    jest.useFakeTimers();
    print.mockReturnValue(new Promise(() => {}));
    const p = printHtmlToFile('<p/>').catch((e) => e);
    await jest.advanceTimersByTimeAsync(PRINT_TIMEOUT_MS * 2);
    expect(await p).toBeInstanceOf(PrintTimeoutError);
    expect(print).toHaveBeenCalledTimes(2);
  });

  it('the limit is well above a healthy print (0.4–1.3 s measured) and below a long wait', () => {
    expect(PRINT_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(PRINT_TIMEOUT_MS).toBeLessThanOrEqual(20_000);
  });

  it('a late result from an abandoned print is deleted, not used', async () => {
    jest.useFakeTimers();
    const late = deferred<{ uri: string }>();
    print.mockReturnValueOnce(late.promise).mockResolvedValueOnce({ uri: 'file:///r.pdf' });
    const p = printHtmlToFile('<p/>');
    await jest.advanceTimersByTimeAsync(PRINT_TIMEOUT_MS);
    await expect(p).resolves.toBe('file:///r.pdf');

    late.resolve({ uri: 'file:///late.pdf' });
    await Promise.resolve();
    await Promise.resolve();
    expect(deleteAsync).toHaveBeenCalledWith('file:///late.pdf', { idempotent: true });
    expect(deleteAsync).not.toHaveBeenCalledWith('file:///r.pdf', expect.anything());
  });

  it('logs how late an abandoned print answered, to tell slow from stuck', async () => {
    jest.useFakeTimers();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const late = deferred<{ uri: string }>();
    print.mockReturnValueOnce(late.promise).mockResolvedValueOnce({ uri: 'file:///r.pdf' });
    const p = printHtmlToFile('<p/>');
    await jest.advanceTimersByTimeAsync(PRINT_TIMEOUT_MS);
    await p;
    late.resolve({ uri: 'file:///late.pdf' });
    await Promise.resolve();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[print\] late result after \d+ms/));
    log.mockRestore();
  });

  it('a late failure of an abandoned print is ignored', async () => {
    jest.useFakeTimers();
    const late = deferred<{ uri: string }>();
    print.mockReturnValueOnce(late.promise).mockResolvedValueOnce({ uri: 'file:///next.pdf' });
    const p = printHtmlToFile('<p/>');
    await jest.advanceTimersByTimeAsync(PRINT_TIMEOUT_MS);
    await expect(p).resolves.toBe('file:///next.pdf');
    late.reject(pdfWriteError()); // must not surface anywhere
    await Promise.resolve();
  });

  it('a successful print clears its timer', async () => {
    jest.useFakeTimers();
    print.mockResolvedValueOnce({ uri: 'file:///r.pdf' });
    await expect(printHtmlToFile('<p/>')).resolves.toBe('file:///r.pdf');
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('Sentry gets the print error, not "unknown database error" (CT7-068)', () => {
  it('forwards known expo-print codes and the timeout name', () => {
    expect(sanitizeForSentry(pdfWriteError()).message).toBe('ERR_PDF_WRITE');
    expect(sanitizeForSentry({ code: 'ERR_PDF_WRITE' }).message).toBe('ERR_PDF_WRITE');
    expect(sanitizeForSentry(new PrintTimeoutError()).name).toBe('PrintTimeoutError');
  });

  it('never forwards an unknown ERR_-shaped code (plain object or Error)', () => {
    expect(sanitizeForSentry({ code: 'ERR_TENANT_27821234567' }).message).toBe(
      'unknown database error'
    );
    const err = Object.assign(new Error('lookup failed for 27821234567'), {
      code: 'ERR_TENANT_27821234567',
    });
    const out = sanitizeForSentry(err);
    expect(out.message).toBe('unknown database error');
    expect(out.stack).not.toContain('27821234567');
  });
});

describe('warmUpPrinter (CT7-069)', () => {
  beforeEach(() => {
    print.mockReset();
    deleteAsync.mockClear();
    resetPrinterWarmUpForTests();
  });

  it('prints one blank page per app process and deletes it', async () => {
    print.mockResolvedValue({ uri: 'file:///warm.pdf' });
    warmUpPrinter();
    warmUpPrinter(); // second screen mount: no second print
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(print).toHaveBeenCalledTimes(1);
    expect(deleteAsync).toHaveBeenCalledWith('file:///warm.pdf', { idempotent: true });
  });

  it('a failed or stuck warm-up is ignored and the real export still prints', async () => {
    jest.useFakeTimers();
    print
      .mockReturnValueOnce(new Promise(() => {})) // warm-up hangs
      .mockResolvedValueOnce({ uri: 'file:///r.pdf' });
    warmUpPrinter();
    await jest.advanceTimersByTimeAsync(PRINT_TIMEOUT_MS); // warm-up times out silently
    await expect(printHtmlToFile('<p/>')).resolves.toBe('file:///r.pdf');
    jest.useRealTimers();
  });

  it.each(['InspectionScreen.tsx', 'OwnerInspectionDetailScreen.tsx'])(
    '%s warms the printer up on mount',
    (file) => {
      const src = require('fs').readFileSync(
        require('path').resolve(__dirname, '../../../features/inspections/screens', file),
        'utf8'
      );
      expect(src).toMatch(/useEffect\(\(\) => \{\s*warmUpPrinter\(\);\s*\}, \[\]\);/);
    }
  );
});
