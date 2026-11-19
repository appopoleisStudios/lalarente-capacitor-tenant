/**
 * CT7-053 regression guard. Android alerts show at most three buttons: React
 * Native keeps `buttons.slice(0, 3)` and drops the rest, and the dialog can't
 * be dismissed with Back. Choices vanished on Android ("Dedicated Vendors",
 * "5 Years", country codes, the Cancel of pickers). An alert with more than
 * three buttons must use `showChoices` (ChoiceSheet), which lists them all.
 *
 * Every `Alert.alert(…)` must pass its buttons as an array literal (or a
 * conditional between array literals) with at most three entries, so the
 * count can be checked here. Dynamic lists go through `showChoices`.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const DIRS = ['src', 'app'].map((d) => path.join(ROOT, d));
const MAX = 3;
const SHOW_CHOICES = 'src/shared/components/ui/ChoiceSheet.tsx';

// Buttons built in a variable, each checked by hand: file → variable → why ≤ 3.
const VARIABLE_BUTTONS: Record<string, string> = {
  'src/features/tenant/screens/TenantLeaseScreen.tsx': 'buttons: Not now + one CTA, or OK',
};

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Source with comments, strings and template literals blanked (same length). */
export function blank(src: string): string {
  const out = src.split('');
  let i = 0;
  const wipe = (from: number, to: number) => {
    for (let k = from; k < to; k += 1) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? src.length : end;
      wipe(i, stop);
      i = stop;
    } else if (c === '/' && src[i + 1] === '*') {
      const stop = src.indexOf('*/', i + 2) + 2;
      wipe(i, stop);
      i = stop;
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') j += 1;
        else if (c === '`' && src[j] === '$' && src[j + 1] === '{') {
          // keep `${…}` expressions out of the count: blank them too
          let depth = 1;
          j += 2;
          while (j < src.length && depth > 0) {
            if (src[j] === '{') depth += 1;
            else if (src[j] === '}') depth -= 1;
            j += 1;
          }
          continue;
        }
        j += 1;
      }
      wipe(i + 1, j);
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return out.join('');
}

/** Top-level comma-separated parts between the bracket at `open` and its match. */
function parts(src: string, open: number): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) {
      depth -= 1;
      if (depth === 0) {
        out.push(src.slice(start, i));
        return out.filter((p) => p.trim() !== '');
      }
    } else if (c === ',' && depth === 1) {
      out.push(src.slice(start, i));
      start = i + 1;
    }
  }
  throw new Error('unbalanced brackets');
}

/** Most buttons an expression can produce, or null when it can't be told. */
export function maxButtons(expr: string): number | null {
  const e = expr.trim();
  if (e.startsWith('[')) {
    let total = 0;
    for (const part of parts(e, 0)) {
      const p = part.trim();
      if (p.startsWith('...')) {
        const arrays = [...p.matchAll(/\[/g)].map((m) => {
          const inner = parts(p, m.index!);
          return inner.length;
        });
        total += arrays.length ? Math.max(...arrays) : Infinity;
      } else total += 1;
    }
    return total;
  }
  // cond ? [..] : [..]
  const q = e.indexOf('?');
  if (q > 0) {
    const arrays = [...e.matchAll(/(?:\?|:)\s*\[/g)].map((m) =>
      maxButtons(e.slice(m.index! + m[0].length - 1))
    );
    if (arrays.length === 2 && arrays.every((n) => n !== null))
      return Math.max(...(arrays as number[]));
  }
  return null;
}

/** Each `Alert.alert(…)` with its buttons argument (or null when it has none). */
export function alertCalls(src: string): { line: number; buttons: string | null }[] {
  const code = blank(src);
  return [...code.matchAll(/\bAlert\.alert\(/g)].map((m) => {
    const args = parts(code, m.index! + m[0].length - 1);
    return {
      line: code.slice(0, m.index).split('\n').length,
      buttons: args.length >= 3 ? args[2] : null,
    };
  });
}

function offenders(): string[] {
  const out: string[] = [];
  for (const file of DIRS.flatMap(sourceFiles)) {
    const rel = path.relative(ROOT, file);
    if (rel === SHOW_CHOICES) continue; // its Alert.alert only ever gets ≤ 3
    for (const { line, buttons } of alertCalls(fs.readFileSync(file, 'utf8'))) {
      if (buttons === null) continue;
      const n = maxButtons(buttons);
      if (n === null && VARIABLE_BUTTONS[rel]) continue;
      if (n === null) out.push(`${rel}:${line} buttons not a literal array — use showChoices`);
      else if (n > MAX) out.push(`${rel}:${line} has ${n} buttons — use showChoices`);
    }
  }
  return out;
}

describe('Android alerts never lose buttons (CT7-053)', () => {
  it('no Alert.alert passes more than three buttons', () => {
    expect(offenders()).toEqual([]);
  });

  it('the variable-buttons allowlist still points at real Alert.alert calls', () => {
    for (const rel of Object.keys(VARIABLE_BUTTONS)) {
      const calls = alertCalls(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
      expect(calls.some((c) => c.buttons !== null && maxButtons(c.buttons) === null)).toBe(true);
    }
  });

  it('the checker counts literal, conditional and spread buttons and ignores comments', () => {
    const count = (src: string) => alertCalls(src).map((c) => c.buttons && maxButtons(c.buttons));
    expect(
      count(`Alert.alert('a', 'b', [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }])`)
    ).toEqual([4]);
    expect(count(`Alert.alert('a', "don't, ok", [{ text: 'x, y' }])`)).toEqual([1]);
    expect(
      count(
        `// can't\nAlert.alert(\`t \${a}\`, 'm', c ? [{ text: 'A' }] : [{ text: 'A' }, { text: 'B' }])`
      )
    ).toEqual([2]);
    expect(
      count(`Alert.alert('a', 'b', [{ text: 'OK' }, ...(x ? [{ text: 'Go' }] : [])])`)
    ).toEqual([2]);
    expect(count(`Alert.alert('a', 'b', buttons)`)).toEqual([null]);
    expect(count(`Alert.alert('a')`)).toEqual([null]);
  });
});
