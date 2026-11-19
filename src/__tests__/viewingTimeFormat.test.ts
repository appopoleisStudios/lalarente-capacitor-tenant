/**
 * CT7-062: viewing times were shown raw from Postgres. Owner and tenant saw
 * "10:00:00" (a `time` column with seconds) on viewing cards and detail
 * screens, and the viewing timeline showed "2026/11/19, 03:05:01"
 * (toLocaleString('en-ZA') with no options).
 *
 * Every viewing time goes through formatTime (src/shared/utils/format) and
 * every date-time through formatDate(x, 'datetime'). Interpolating a
 * requested_time / confirmed_time column straight into JSX or a template
 * string, or calling new Date(...).toLocaleString('en-ZA') with no options,
 * fails this guard.
 */
import { formatDate, formatTime } from '../shared/utils/format';
import { formatViewingDateTime } from '../features/properties/utils/viewingHelpers';

const fs = jest.requireActual('fs') as typeof import('fs');
const path = jest.requireActual('path') as typeof import('path');

const ROOT = path.join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory())
      return e.name === '__tests__' || e.name === 'node_modules' ? [] : sourceFiles(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

// {viewing.requested_time} in JSX or ${item.requested_time} in a template string.
// `${date}T${v.requested_time}` builds a Date to parse, not display, so it is allowed.
const RAW_VIEWING_TIME = /(?<!T\$)\{\s*[\w.?!]*\.(requested_time|confirmed_time)\s*(\}|\|\||\?\?)/;
// new Date(...).toLocaleString('en-ZA') with no options prints seconds
const DATETIME_WITH_SECONDS =
  /new Date\((?:[^()]|\([^()]*\))*\)\s*\.toLocaleString\(\s*['"]en-ZA['"]\s*\)/;

describe('formatTime (CT7-062)', () => {
  it('drops the seconds from a Postgres time', () => {
    expect(formatTime('10:00:00')).toBe('10:00');
    expect(formatTime('14:30:59.123')).toBe('14:30');
  });

  it('keeps an HH:mm time and pads a single-digit hour', () => {
    expect(formatTime('10:00')).toBe('10:00');
    expect(formatTime('9:05')).toBe('09:05');
  });

  it('reads the time from a local ISO date-time', () => {
    expect(formatTime('2026-11-19T10:00')).toBe('10:00');
    expect(formatTime('2026-11-19T03:05:01')).toBe('03:05');
  });

  it('shows a zoned timestamp in local time without seconds', () => {
    const iso = '2026-11-19T08:15:42Z';
    const d = new Date(iso);
    const expected = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    expect(formatTime(iso)).toBe(expected);
  });

  it("returns '' for empty or invalid input", () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
    expect(formatTime('')).toBe('');
    expect(formatTime('the scheduled time')).toBe('');
    expect(formatTime('25:00:00')).toBe('');
    expect(formatTime('10:75')).toBe('');
  });

  it('formatViewingDateTime shows the time without seconds', () => {
    const out = formatViewingDateTime('2026-11-19', '10:00:00');
    expect(out).toMatch(/ at 10:00$/);
    expect(out).not.toMatch(/:\d\d:\d\d/);
  });

  it("formatDate(x, 'datetime') has no seconds", () => {
    expect(formatDate('2026-11-19T03:05:01', 'datetime')).toMatch(/^19 Nov(\.)? 2026,? 03:05$/);
  });
});

describe('viewing times are formatted, not rendered raw (CT7-062)', () => {
  const files = ['src', 'app'].flatMap((d) => sourceFiles(path.join(ROOT, d)));

  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no raw requested_time/confirmed_time and no seconds in date-times', () => {
    const offenders = files.flatMap((f) => {
      const src = fs.readFileSync(f, 'utf8');
      const hits = [];
      if (RAW_VIEWING_TIME.test(src))
        hits.push(`${path.relative(ROOT, f)}: raw viewing time — use formatTime()`);
      if (DATETIME_WITH_SECONDS.test(src))
        hits.push(
          `${path.relative(ROOT, f)}: toLocaleString('en-ZA') shows seconds — use formatDate(x, 'datetime')`
        );
      return hits;
    });
    expect(offenders).toEqual([]);
  });

  it('the guard patterns catch the forms that shipped the bug', () => {
    expect(RAW_VIEWING_TIME.test('at {viewing.requested_time}')).toBe(true);
    expect(RAW_VIEWING_TIME.test('`Requested: x at ${item.requested_time}`')).toBe(true);
    expect(RAW_VIEWING_TIME.test("at {viewing.requested_time || '—'}")).toBe(true);
    expect(RAW_VIEWING_TIME.test("${v.requested_time ?? ''}")).toBe(true);
    expect(RAW_VIEWING_TIME.test('at {formatTime(viewing.requested_time)}')).toBe(false);
    expect(RAW_VIEWING_TIME.test('requested_time: v.requested_time,')).toBe(false);
    expect(RAW_VIEWING_TIME.test('new Date(`${v.requested_date}T${v.requested_time}`)')).toBe(
      false
    );
    expect(
      DATETIME_WITH_SECONDS.test("new Date(viewing.created_at!).toLocaleString('en-ZA')")
    ).toBe(true);
    expect(DATETIME_WITH_SECONDS.test("(rent || 0).toLocaleString('en-ZA')")).toBe(false);
    expect(
      DATETIME_WITH_SECONDS.test("new Date(x).toLocaleString('en-ZA', { hour: '2-digit' })")
    ).toBe(false);
  });
});

describe('viewing notification text (CT7-062)', () => {
  it('formats the date and time stored in the notification body', () => {
    const src = jest
      .requireActual('fs')
      .readFileSync(
        jest
          .requireActual('path')
          .join(__dirname, '../features/notifications/api/notificationsApi.ts'),
        'utf8'
      ) as string;
    // No raw viewing date/time interpolated into notification text
    expect(src).not.toMatch(
      /\$\{data\?\.(requestedDate|confirmedDate|viewingDate|viewingTime)\s*\|\|/
    );
  });
});
