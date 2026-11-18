/**
 * CT7-047 regression guard. On Android an RN <Modal> window does not resize
 * for the keyboard, so a modal with text inputs must lift its content itself
 * with a KeyboardAvoidingView whose `behavior` is set on Android too —
 * `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` does nothing on
 * Android (build 11: vendor "Add Service" — Base Price and the Add button were
 * hidden behind the keyboard while typing).
 *
 * A modal counts as having inputs when it renders TextInput / TextArea /
 * Input directly, or `{children}` (a container such as ModalSheet, whose
 * callers pass text areas in).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const DIRS = ['src', 'app'].map((d) => path.join(ROOT, d));

const INPUT = /<(TextInput|TextArea|Input)[\s/>]|\{children\}/;
const KAV = /<KeyboardAvoidingView\b([^>]*)>/g;

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

/** True when some KeyboardAvoidingView in the block sets an Android behavior. */
function liftsOnAndroid(body: string): boolean {
  for (const m of body.matchAll(KAV)) {
    const attrs = m[1];
    const behavior = /behavior=\{([^}]*)\}|behavior="(\w+)"/.exec(attrs);
    if (!behavior) continue; // no behavior → nothing happens on Android
    const expr = behavior[1] ?? behavior[2];
    if (/:\s*undefined/.test(expr)) continue; // iOS only
    return true;
  }
  return false;
}

function offenders(): string[] {
  const out: string[] = [];
  for (const file of DIRS.flatMap(sourceFiles)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const { start, body } of modalBlocks(src)) {
      if (INPUT.test(body) && !liftsOnAndroid(body)) {
        out.push(`${path.relative(ROOT, file)}:${src.slice(0, start).split('\n').length}`);
      }
    }
  }
  return out;
}

describe('modals with text inputs lift above the keyboard on Android (CT7-047)', () => {
  it('every <Modal> with inputs has a KeyboardAvoidingView with an Android behavior', () => {
    expect(offenders()).toEqual([]);
  });

  it('the checker itself rejects iOS-only and missing behaviors', () => {
    expect(
      liftsOnAndroid(`<KeyboardAvoidingView style={s}><TextInput /></KeyboardAvoidingView>`)
    ).toBe(false);
    expect(
      liftsOnAndroid(
        `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>`
      )
    ).toBe(false);
    expect(
      liftsOnAndroid(
        `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>`
      )
    ).toBe(true);
    expect(modalBlocks('<Modal a><Modal b></Modal></Modal><ModalSheet />')).toHaveLength(1);
  });
});
