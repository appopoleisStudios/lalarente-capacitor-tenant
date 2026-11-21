/**
 * CT7-046 regression guard. On Android (edge-to-edge) a sliding sheet or
 * full-screen modal draws under the navigation bar unless it pads by the
 * bottom inset, so its last button sat under the nav buttons (build 11).
 * The Maestro sheet guards only screenshot the sheets and can't fail on a
 * missing inset; this static check can.
 *
 * Every <Modal animationType="slide"> (and the shared Select) must apply the
 * bottom inset: `insets.bottom`, or render inside <ModalSheet>, or a
 * SafeAreaView whose `edges` include 'bottom'.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const DIRS = ['src', 'app'].map((d) => path.join(ROOT, d));
// bottom sheets that open with a non-slide animation
const ALSO_SHEETS = ['src/shared/components/forms/Select.tsx'];

// The inset must feed a BOTTOM spacing (paddingTop: insets.bottom doesn't
// count), or the sheet is a ModalSheet, or a SafeAreaView keeps the bottom edge.
const CLEARS_NAV_BAR =
  /\b(paddingBottom|marginBottom|bottom)\s*:[^:]{0,120}?\binsets\.bottom\b|<ModalSheet[\s>]|edges=\{\[[^\]]*'bottom'/;

/** Drop comments, so commented-out code can't satisfy the check. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

/** Each top-level `<Modal …>…</Modal>` block, nested Modals paired correctly. */
function modalBlocks(src: string): { start: number; body: string }[] {
  const tag = /<Modal[\s>]|<\/Modal>/g;
  const blocks: { start: number; body: string }[] = [];
  let depth = 0;
  let start = -1;
  for (let m = tag.exec(src); m; m = tag.exec(src)) {
    if (m[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0 && start >= 0) blocks.push({ start, body: src.slice(start, m.index) });
    } else {
      if (depth === 0) start = m.index;
      depth += 1;
    }
  }
  return blocks;
}

function sheets(): { where: string; body: string }[] {
  const out: { where: string; body: string }[] = [];
  for (const file of DIRS.flatMap(sourceFiles)) {
    const rel = path.relative(ROOT, file);
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    for (const { start, body } of modalBlocks(src)) {
      const openTag = body.slice(0, body.indexOf('>') + 1);
      if (/animationType="slide"/.test(openTag) || ALSO_SHEETS.includes(rel)) {
        out.push({ where: `${rel}:${src.slice(0, start).split('\n').length}`, body });
      }
    }
  }
  return out;
}

describe('bottom sheets and slide-up modals clear the Android nav bar (CT7-046)', () => {
  const all = sheets();

  it('finds the sheets (the scan is not silently empty)', () => {
    // 22 at the time of writing (CT7-046 fixed 14 sheets + 5 owner modals)
    expect(all.length).toBeGreaterThanOrEqual(20);
  });

  it('every one applies the bottom inset', () => {
    expect(all.filter((s) => !CLEARS_NAV_BAR.test(s.body)).map((s) => s.where)).toEqual([]);
  });

  it('the checker rejects a sheet without the inset', () => {
    expect(CLEARS_NAV_BAR.test('<View style={styles.sheet}><Button /></View>')).toBe(false);
    expect(CLEARS_NAV_BAR.test("<SafeAreaView edges={['top']}>")).toBe(false);
    expect(CLEARS_NAV_BAR.test("<SafeAreaView edges={['top', 'bottom']}>")).toBe(true);
    expect(CLEARS_NAV_BAR.test('style={{ paddingTop: insets.bottom }}')).toBe(false);
    expect(CLEARS_NAV_BAR.test('{ paddingBottom: 0, top: insets.bottom }')).toBe(false);
    expect(CLEARS_NAV_BAR.test('{ paddingBottom: Math.max(40, insets.bottom + 8) }')).toBe(true);
    expect(
      CLEARS_NAV_BAR.test(
        stripComments('{/* paddingBottom: insets.bottom */}\n// paddingBottom: insets.bottom')
      )
    ).toBe(false);
  });
});
