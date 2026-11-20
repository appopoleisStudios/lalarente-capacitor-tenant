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

  it('retries a failed WebView print and returns the file', async () => {
    print.mockRejectedValueOnce(pdfWriteError()).mockResolvedValueOnce({ uri: 'file:///r.pdf' });
    await expect(printHtmlToFile('<p/>')).resolves.toBe('file:///r.pdf');
    expect(print).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last attempt with the real error', async () => {
    print.mockRejectedValue(pdfWriteError());
    const err = await printHtmlToFile('<p/>').catch((e) => e);
    expect(print).toHaveBeenCalledTimes(PRINT_ATTEMPTS);
    expect(err.code).toBe('ERR_PDF_WRITE');
  });

  it('a print that never calls back ends the export (no endless spinner, no stacked render)', async () => {
    jest.useFakeTimers();
    print.mockReturnValue(new Promise(() => {}));
    const p = printHtmlToFile('<p/>').catch((e) => e);
    await jest.advanceTimersByTimeAsync(PRINT_TIMEOUT_MS);
    expect(await p).toBeInstanceOf(PrintTimeoutError);
    expect(print).toHaveBeenCalledTimes(1); // not retried while the native render may still run
  });

  it('a late result from an abandoned print is deleted, not used', async () => {
    jest.useFakeTimers();
    const late = deferred<{ uri: string }>();
    print.mockReturnValueOnce(late.promise);
    const p = printHtmlToFile('<p/>').catch((e) => e);
    await jest.advanceTimersByTimeAsync(PRINT_TIMEOUT_MS);
    expect(await p).toBeInstanceOf(PrintTimeoutError);

    late.resolve({ uri: 'file:///late.pdf' });
    await Promise.resolve();
    await Promise.resolve();
    expect(deleteAsync).toHaveBeenCalledWith('file:///late.pdf', { idempotent: true });
  });

  it('a late failure of an abandoned print is ignored, and the next export works', async () => {
    jest.useFakeTimers();
    const late = deferred<{ uri: string }>();
    print.mockReturnValueOnce(late.promise).mockResolvedValueOnce({ uri: 'file:///next.pdf' });
    const p = printHtmlToFile('<p/>').catch((e) => e);
    await jest.advanceTimersByTimeAsync(PRINT_TIMEOUT_MS);
    expect(await p).toBeInstanceOf(PrintTimeoutError);
    late.reject(pdfWriteError()); // must not surface anywhere
    await expect(printHtmlToFile('<p/>')).resolves.toBe('file:///next.pdf');
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
