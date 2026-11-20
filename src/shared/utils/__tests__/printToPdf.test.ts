// CT7-068: the Android WebView print step fails now and then (ERR_PDF_WRITE)
// or never calls back. Report exports must retry and never hang.
import * as Print from 'expo-print';
import { sanitizeForSentry } from '@/src/core/observability/sentry';
import {
  printHtmlToFile,
  PrintTimeoutError,
  PRINT_ATTEMPTS,
  PRINT_TIMEOUT_MS,
} from '../printToPdf';

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('@/src/core/config/env', () => ({ env: { sentry: { dsn: '' } } }));

const print = Print.printToFileAsync as jest.Mock;

// What expo-print rejects with when Chromium reports "Printing failed."
const pdfWriteError = () =>
  Object.assign(new Error('An error occured while writing the PDF data'), {
    code: 'ERR_PDF_WRITE',
  });

describe('printHtmlToFile (CT7-068)', () => {
  beforeEach(() => print.mockReset());
  afterEach(() => jest.useRealTimers());

  it('retries a failed WebView print and returns the file', async () => {
    print.mockRejectedValueOnce(pdfWriteError()).mockResolvedValueOnce({ uri: 'file:///r.pdf' });
    await expect(printHtmlToFile('<p/>')).resolves.toBe('file:///r.pdf');
    expect(print).toHaveBeenCalledTimes(2);
  });

  it('a print that never calls back times out and is retried, not left spinning', async () => {
    jest.useFakeTimers();
    print
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValueOnce({ uri: 'file:///r.pdf' });
    const p = printHtmlToFile('<p/>');
    await jest.advanceTimersByTimeAsync(PRINT_TIMEOUT_MS);
    await expect(p).resolves.toBe('file:///r.pdf');
  });

  it('gives up after the last attempt with the real error', async () => {
    print.mockRejectedValue(pdfWriteError());
    const err = await printHtmlToFile('<p/>').catch((e) => e);
    expect(print).toHaveBeenCalledTimes(PRINT_ATTEMPTS);
    expect(err.code).toBe('ERR_PDF_WRITE');
  });

  it('every hang times out: the export always ends', async () => {
    jest.useFakeTimers();
    print.mockReturnValue(new Promise(() => {}));
    const p = printHtmlToFile('<p/>').catch((e) => e);
    await jest.advanceTimersByTimeAsync(PRINT_TIMEOUT_MS * PRINT_ATTEMPTS);
    expect(await p).toBeInstanceOf(PrintTimeoutError);
  });

  it('Sentry gets the print error code and timeout name, not "unknown database error"', () => {
    expect(sanitizeForSentry(pdfWriteError()).message).toBe('ERR_PDF_WRITE');
    const timeout = sanitizeForSentry(new PrintTimeoutError());
    expect(timeout.name).toBe('PrintTimeoutError');
    // codes that aren't Expo-shaped identifiers are still not forwarded
    expect(sanitizeForSentry({ code: 'ERR_x tenant@example.com' }).message).toBe(
      'unknown database error'
    );
  });
});
