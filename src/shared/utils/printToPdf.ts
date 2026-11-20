import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

// CT7-068: expo-print renders HTML in a hidden Android WebView. Chromium's
// print step fails now and then ("Printing failed" → ERR_PDF_WRITE) or never
// calls back, which left the export spinner running forever.
// - A failed print is retried (it fails fast, nothing is left running).
// - A print that doesn't answer in time fails the export with
//   PrintTimeoutError and is NOT retried: expo-print can't cancel the native
//   render, so retrying would stack WebViews. If the abandoned render finishes
//   later, its file is deleted.

export const PRINT_TIMEOUT_MS = 45_000;
export const PRINT_ATTEMPTS = 3;

export class PrintTimeoutError extends Error {
  constructor() {
    super('PDF printing timed out');
    this.name = 'PrintTimeoutError';
  }
}

function printOnce(html: string, timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new PrintTimeoutError());
    }, timeoutMs);

    Print.printToFileAsync({ html, base64: false }).then(
      ({ uri }) => {
        clearTimeout(timer);
        if (timedOut) {
          // late result of an abandoned render: nobody will use it
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        } else {
          resolve(uri);
        }
      },
      (err) => {
        clearTimeout(timer);
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
  for (let i = 0; i < attempts; i++) {
    try {
      return await printOnce(html, timeoutMs);
    } catch (err) {
      if (err instanceof PrintTimeoutError) throw err;
      lastError = err;
    }
  }
  throw lastError;
}
