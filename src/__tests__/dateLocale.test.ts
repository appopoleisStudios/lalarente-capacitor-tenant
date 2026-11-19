/**
 * CT7-060: dates followed the phone's language setting. On an English (US)
 * phone the tenant's rent showed "Due: 12/1/2026", which a South African
 * reads as 12 January, while other screens showed "2026/12/01".
 *
 * Every date shown to a user goes through formatDate (src/shared/utils/format),
 * or names the locale explicitly. A bare toLocaleDateString() /
 * toLocaleTimeString(), or toLocaleString() on a Date, fails this guard.
 * So does toLocaleDateString('en-ZA') with no options: that renders
 * "2026/11/19" (found on Viewing Requests in the build-12 device check).
 */
import { formatDate } from '../shared/utils/format';

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

const BARE_DATE = /\.toLocale(Date|Time)String\(\s*\)/;
// new Date(...).toLocaleString() with no locale; the argument may span lines
// 'en-ZA' with no format options → "2026/11/19"
const ENZA_DEFAULT_DATE = /\.toLocaleDateString\(\s*['"]en-ZA['"]\s*\)/;
const BARE_DATETIME = /new Date\((?:[^()]|\([^()]*\))*\)\s*\.toLocaleString\(\s*\)/;

describe('dates use a fixed locale (CT7-060)', () => {
  const files = ['src', 'app'].flatMap((d) => sourceFiles(path.join(ROOT, d)));

  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no bare toLocaleDateString()/toLocaleTimeString()/Date toLocaleString()', () => {
    const offenders = files.flatMap((f) => {
      const src = fs.readFileSync(f, 'utf8');
      const hits = [];
      if (BARE_DATE.test(src))
        hits.push(`${path.relative(ROOT, f)}: bare toLocale(Date|Time)String()`);
      if (BARE_DATETIME.test(src))
        hits.push(`${path.relative(ROOT, f)}: new Date(...).toLocaleString()`);
      if (ENZA_DEFAULT_DATE.test(src))
        hits.push(`${path.relative(ROOT, f)}: toLocaleDateString('en-ZA') without options`);
      return hits;
    });
    expect(offenders).toEqual([]);
  });

  it('the guard patterns catch the forms that shipped the bug', () => {
    expect(BARE_DATE.test('new Date(p.due_date).toLocaleDateString()')).toBe(true);
    expect(BARE_DATE.test("d.toLocaleDateString('en-ZA')")).toBe(false);
    expect(ENZA_DEFAULT_DATE.test("new Date(item.created_at!).toLocaleDateString('en-ZA')")).toBe(
      true
    );
    expect(
      ENZA_DEFAULT_DATE.test("d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })")
    ).toBe(false);
    expect(
      BARE_DATETIME.test('new Date(\n  a.submitted_at || a.created_at!\n).toLocaleString()')
    ).toBe(true);
    expect(BARE_DATETIME.test('(rent || 0).toLocaleString()')).toBe(false);
  });

  it('formatDate gives an unambiguous day-month-year whatever the phone language', () => {
    expect(formatDate('2026-12-01T10:00:00Z')).toMatch(/^0?1 Dec(\.)? 2026$/);
    expect(formatDate(null)).toBe('');
    expect(formatDate('not a date')).toBe('');
  });
});
