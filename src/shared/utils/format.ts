/**
 * Single source of truth for locale-sensitive formatting.
 *
 * All formatting uses 'en-ZA' locale so currency, dates, and numbers
 * render consistently across owner, tenant, and vendor screens.
 *
 * Usage:
 *   import { formatCurrency, formatDate } from '@/src/shared/utils/format';
 */

/**
 * Format a rand amount: R 1 234.56 (en-ZA grouping, 2 decimal places).
 * Returns 'R 0.00' for null/undefined/NaN.
 */
export function formatCurrency(amount: number | null | undefined): string {
  const n = amount ?? 0;
  if (isNaN(n)) return 'R 0.00';
  return n.toLocaleString('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type DateStyle = 'short' | 'long' | 'datetime';

/**
 * Format a date string or Date object for display.
 *
 * - 'short'    → '15 Jan 2026'
 * - 'long'     → '15 January 2026'
 * - 'datetime' → '15 Jan 2026, 14:30'
 *
 * Returns '' for null/undefined/invalid input.
 */
export function formatDate(
  date: string | Date | null | undefined,
  style: DateStyle = 'short'
): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  if (style === 'short') {
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (style === 'long') {
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  // datetime
  return d.toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a time of day for display: '10:00' (24-hour, no seconds).
 *
 * Accepts a Postgres `time` ('10:00:00', '9:30'), a local date-time
 * ('2026-11-19T10:00'), or a zoned timestamp ('2026-11-19T08:00:00Z',
 * shown in the phone's local time).
 *
 * Returns '' for null/undefined/invalid input.
 */
export function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const local = /^(?:\d{4}-\d{2}-\d{2}[T ])?(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(
    time.trim()
  );
  if (local) {
    const h = Number(local[1]);
    if (h > 23 || Number(local[2]) > 59) return '';
    return `${String(h).padStart(2, '0')}:${local[2]}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(time)) return '';
  const d = new Date(time);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
