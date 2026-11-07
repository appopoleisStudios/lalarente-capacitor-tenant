// Lease date math (CT7-020). Timezone-safe + calendar-correct helpers
// shared between the lease-create picker and any downstream rendering.
//
// Why not toISOString().split('T')[0]: that converts through UTC, so a
// local-midnight Date in a positive UTC offset turns into the PREVIOUS
// calendar day's ISO string. The round-trip also mis-displays the
// stored date on devices in a negative UTC offset. Use local components
// for both directions so "2026-11-07" always means "November 7th" to
// the owner regardless of timezone.

/** Format a Date as `YYYY-MM-DD` using LOCAL calendar components. Safe
 *  across timezones. */
export function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a `YYYY-MM-DD` string into a local-midnight Date (not UTC
 *  midnight — that would display as the previous day in some zones). */
export function fromLocalIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

/** Add one calendar month to a date, clamping day-of-month to the last
 *  day of the target month so January 31 + 1 month = February 28/29,
 *  not March 3. JS's native setMonth() overflows into the following
 *  month on short-month boundaries. */
export function addOneCalendarMonth(d: Date): Date {
  const targetMonth = d.getMonth() + 1;
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
  const normMonth = targetMonth % 12;

  // Last day of the target month, obtained by rolling into the month
  // after and stepping back one day (setDate(0)).
  const lastDayOfTarget = new Date(targetYear, normMonth + 1, 0).getDate();
  const clampedDay = Math.min(d.getDate(), lastDayOfTarget);

  return new Date(targetYear, normMonth, clampedDay);
}

/** True if candidate (a Date or YYYY-MM-DD string) is strictly BEFORE
 *  minimum, comparing by calendar day only (time ignored). */
export function isDateBefore(candidate: Date | string, minimum: Date): boolean {
  const c = typeof candidate === 'string' ? fromLocalIsoDate(candidate) : candidate;
  const normC = new Date(c.getFullYear(), c.getMonth(), c.getDate()).getTime();
  const normM = new Date(minimum.getFullYear(), minimum.getMonth(), minimum.getDate()).getTime();
  return normC < normM;
}
