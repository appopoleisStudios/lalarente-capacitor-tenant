/**
 * CT7-061: the vendor's "View My Jobs" button went to '/(vendor)/jobs/index'.
 * expo-router does not treat "index" in a URL as the index route: it matched
 * jobs/[id] with id = "index", so the vendor got "Failed to load job details".
 *
 * Navigate to the folder ('/(vendor)/jobs'), never to '<folder>/index'.
 * (Tabs.Screen names such as name="jobs/index" are route-file names, not
 * URLs, and are not affected.)
 */
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

// a route literal such as '/(vendor)/jobs/index' or `/(owner)/x/index?y=1`
const INDEX_URL = /['"`]\/[^'"`\s]*\/index(\?[^'"`]*)?['"`]/;

describe('no navigation to a "<folder>/index" URL (CT7-061)', () => {
  it('the pattern catches the shipped bug and ignores route-file names', () => {
    expect(INDEX_URL.test("router.replace('/(vendor)/jobs/index')")).toBe(true);
    expect(INDEX_URL.test(': `/(vendor)/jobs/index`;')).toBe(true);
    expect(INDEX_URL.test("router.replace('/(vendor)/jobs')")).toBe(false);
    expect(INDEX_URL.test('<Tabs.Screen name="jobs/index" />')).toBe(false);
  });

  it('no source file navigates to one', () => {
    const files = ['src', 'app'].flatMap((d) => sourceFiles(path.join(ROOT, d)));
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.flatMap((f) =>
      fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => (INDEX_URL.test(line) ? `${path.relative(ROOT, f)}:${i + 1}` : null))
        .filter(Boolean)
    );
    expect(offenders).toEqual([]);
  });
});
