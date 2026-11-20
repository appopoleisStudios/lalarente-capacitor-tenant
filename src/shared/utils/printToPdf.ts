import * as Print from 'expo-print';

// CT7-068: expo-print renders HTML in a hidden Android WebView. Chromium's
// print step fails now and then ("Printing failed" → ERR_PDF_WRITE) or never
// calls back, which left the export spinner running forever. Each attempt is
// time-limited and a failed attempt is retried.

export const PRINT_TIMEOUT_MS = 45_000;
export const PRINT_ATTEMPTS = 3;

export class PrintTimeoutError extends Error {
  constructor() {
    super('PDF printing timed out');
    this.name = 'PrintTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PrintTimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function printHtmlToFile(
  html: string,
  attempts: number = PRINT_ATTEMPTS,
  timeoutMs: number = PRINT_TIMEOUT_MS
): Promise<string> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const { uri } = await withTimeout(Print.printToFileAsync({ html, base64: false }), timeoutMs);
      return uri;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
