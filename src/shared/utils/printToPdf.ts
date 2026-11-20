import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

// CT7-068: expo-print renders HTML in a hidden Android WebView. Chromium's
// print step fails now and then ("Printing failed" → ERR_PDF_WRITE) or never
// calls back, which left the export spinner running forever.
// - A failed print is retried (it fails fast, nothing is left running).
// - CT7-069, measured on the emulator: a print either finishes in 0.4–1.3 s or
//   never answers at all (no late result after 2+ min), and every hang was the
//   first print in a fresh app process; the next print in the same process
//   always worked, even right after a hang. So a print that doesn't answer in
//   15 s is retried ONCE. expo-print can't cancel the stuck render, so at most
//   one abandoned WebView is left per export; if it ever answers, its file is
//   deleted.
// - Fast ERR_PDF_WRITE failures cluster right after app start (two failed
//   40 ms apart in one export), so a failed print is retried after a short,
//   growing pause instead of immediately.

export const PRINT_TIMEOUT_MS = 15_000;
export const PRINT_ATTEMPTS = 4;
export const PRINT_TIMEOUT_RETRIES = 1;
export const PRINT_RETRY_DELAY_MS = 1_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class PrintTimeoutError extends Error {
  constructor() {
    super('PDF printing timed out');
    this.name = 'PrintTimeoutError';
  }
}

function printOnce(html: string, timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const started = Date.now();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new PrintTimeoutError());
    }, timeoutMs);

    Print.printToFileAsync({ html, base64: false }).then(
      ({ uri }) => {
        clearTimeout(timer);
        if (timedOut) {
          // late result of an abandoned render: nobody will use it. Logged so
          // a slow print can be told from a stuck one (CT7-069).
          console.log(`[print] late result after ${Date.now() - started}ms (discarded)`);
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        } else {
          console.log(`[print] done in ${Date.now() - started}ms`);
          resolve(uri);
        }
      },
      (err) => {
        clearTimeout(timer);
        const code = typeof err?.code === 'string' ? err.code : 'no code';
        console.log(
          `[print] failed after ${Date.now() - started}ms (${code})${timedOut ? ', late' : ''}`
        );
        if (!timedOut) reject(err);
      }
    );
  });
}

export async function printHtmlToFile(
  html: string,
  attempts: number = PRINT_ATTEMPTS,
  timeoutMs: number = PRINT_TIMEOUT_MS
): Promise<string> {
  let lastError: unknown;
  let timeouts = 0;
  for (let i = 0; i < attempts; i++) {
    try {
      return await printOnce(html, timeoutMs);
    } catch (err) {
      if (err instanceof PrintTimeoutError) {
        if (++timeouts > PRINT_TIMEOUT_RETRIES) throw err;
      } else if (i < attempts - 1) {
        await sleep(PRINT_RETRY_DELAY_MS * (i + 1));
      }
      lastError = err;
    }
  }
  throw lastError;
}

let warmUpStarted = false;

/**
 * CT7-069: in 48 device exports every failed or stuck print was the FIRST
 * print in a fresh app process. Screens that can export call this on mount:
 * one blank print per process, in the background, so the user's report is
 * never the first. Its file is deleted; a failure or hang is ignored (nobody
 * waits on it).
 */
export function warmUpPrinter(): void {
  // Android only: that is where the failure was measured, and on web a print
  // opens the browser's print dialog.
  if (Platform.OS !== 'android' || warmUpStarted) return;
  warmUpStarted = true;
  printOnce('<html><body></body></html>', PRINT_TIMEOUT_MS)
    .then((uri) => FileSystem.deleteAsync(uri, { idempotent: true }))
    .catch(() => {});
}

/** Test-only: forget that the warm-up ran. */
export function resetPrinterWarmUpForTests(): void {
  warmUpStarted = false;
}
