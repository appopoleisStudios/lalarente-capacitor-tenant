/**
 * CT7-051 regression guard. Android draws edge-to-edge (targetSdk 35+), so the
 * window is no longer resized for the keyboard. A KeyboardAvoidingView with no
 * Android behavior does nothing, and the lower part of the form stays under
 * the keyboard (lifecycle-06: tenant "Add Comment"; lifecycle-07: tenant
 * Report Issue description field).
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { KeyboardAvoidingView as RNKeyboardAvoidingView, Platform, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';

const ROOT = path.resolve(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

const FILES = ['src', 'app'].flatMap((d) => sourceFiles(path.join(ROOT, d)));
const KAV_TAG = /<KeyboardAvoidingView\b([^>]*)>/g;
const rel = (f: string) => path.relative(ROOT, f);

/** `<KeyboardAvoidingView>` tags whose behavior is missing or iOS-only. */
export function iosOnlyTags(src: string, needsBehavior: boolean): number {
  let bad = 0;
  for (const m of src.matchAll(KAV_TAG)) {
    const behavior = /behavior=\{([^}]*)\}|behavior="(\w+)"/.exec(m[1]);
    if (!behavior) {
      if (needsBehavior) bad += 1;
      continue;
    }
    if (/:\s*undefined/.test(behavior[1] ?? behavior[2])) bad += 1;
  }
  return bad;
}

/** Source with every top-level `<Modal …>…</Modal>` block cut out (modals are guarded separately). */
export function withoutModals(src: string): string {
  const tag = /<Modal[\s>]|<\/Modal>/g;
  let out = '';
  let depth = 0;
  let last = 0;
  for (let m = tag.exec(src); m; m = tag.exec(src)) {
    if (m[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0) last = m.index + m[0].length;
    } else {
      if (depth === 0) out += src.slice(last, m.index);
      depth += 1;
    }
  }
  return depth === 0 ? out + src.slice(last) : out;
}

const TEXT_INPUT = /<(TextInput|TextArea|Input)[\s/>]/;

/** True when the screen body (outside modals) has a text input but no KeyboardAvoidingView. */
export function inputsWithoutKav(src: string): boolean {
  const body = withoutModals(src);
  return TEXT_INPUT.test(body) && !/<KeyboardAvoidingView\b/.test(body);
}

/** Screens whose only text input sits at the top, so the keyboard can never cover it. */
const TOP_INPUT_ONLY: Record<string, string> = {
  'src/features/owner/screens/PropertiesListScreen.tsx': 'search bar above the property list',
  'src/features/owner/screens/VendorSelectionScreen.tsx':
    'search bar / invite-email field right under the tabs; invite card does not scroll',
  'src/features/tenant/screens/TenantVendorMarketplaceScreen.tsx':
    'search bar above the vendor list',
  'src/features/vendor/screens/VendorJobsListScreen.tsx': 'search bar above the jobs list',
  'src/features/vendor/screens/VendorMaintenanceListScreen.tsx':
    'search bar above the request list',
  'app/test-components.tsx': 'dev-only component playground',
};

/** Screens that scroll their own input + button block above the keyboard. */
const OWN_REVEAL: Record<string, string> = {
  'src/features/inspections/screens/InspectionScreen.tsx': 'useRevealAboveKeyboard (CT7-050)',
};

/** `<ScrollView …>` tags that scroll vertically (not `horizontal`, not a type argument). */
export function verticalScrollViews(src: string): number {
  return [...src.matchAll(/(?<![\w.])<ScrollView\b([^>]*)>/g)].filter(
    (m) => !/\bhorizontal\b(?!\s*=\s*\{\s*false)/.test(m[1])
  ).length;
}

/** Styles (StyleSheet entries or inline objects anywhere in a style) that pin a view to the bottom edge. */
export function pinnedFooters(src: string): string[] {
  // every innermost `{ … }` body; named when it is a StyleSheet entry
  return [...src.matchAll(/(?:\n\s*(\w+): )?\{([^{}]*)\}/g)]
    .filter(
      ([, , body]) =>
        /position:\s*['"]absolute['"]/.test(body) &&
        /\bbottom:\s*0\b/.test(body) &&
        !/\btop:/.test(body)
    )
    .map(([, name]) => name ?? 'inline style');
}

/** The source of every top-level KeyboardAvoidingView subtree, nested ones paired correctly. */
export function insideKav(src: string): string {
  const tag = /<KeyboardAvoidingView\b|<\/KeyboardAvoidingView>/g;
  let out = '';
  let depth = 0;
  let start = -1;
  for (let m = tag.exec(src); m; m = tag.exec(src)) {
    if (m[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0 && start >= 0) out += src.slice(start, m.index) + '\n';
    } else {
      if (depth === 0) start = m.index;
      depth += 1;
    }
  }
  return out;
}

const SCREENS = FILES.filter((f) => rel(f).startsWith('app/') || rel(f).includes('/screens/'));

describe('keyboard avoidance works on Android (CT7-051)', () => {
  const realOS = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true });
  });

  it('the shared KeyboardAvoidingView defaults to "height" on Android', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    const { UNSAFE_getByType } = render(
      <KeyboardAvoidingView>
        <Text>x</Text>
      </KeyboardAvoidingView>
    );
    expect(UNSAFE_getByType(RNKeyboardAvoidingView).props.behavior).toBe('height');
  });

  it('…and keeps "padding" on iOS', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const { UNSAFE_getByType } = render(
      <KeyboardAvoidingView>
        <Text>x</Text>
      </KeyboardAvoidingView>
    );
    expect(UNSAFE_getByType(RNKeyboardAvoidingView).props.behavior).toBe('padding');
  });

  it('no KeyboardAvoidingView in the app is iOS-only', () => {
    const offenders = FILES.filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      // react-native's own KAV must always say what to do on Android;
      // the shared one has an Android default when no behavior is passed
      const direct = /import\s*\{[^}]*\bKeyboardAvoidingView\b[^}]*\}\s*from\s*'react-native'/.test(
        src
      );
      return iosOnlyTags(src, direct) > 0;
    }).map(rel);
    expect(offenders).toEqual([]);
  });

  it('a caller-supplied behavior wins over the Android default', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    const { UNSAFE_getByType } = render(
      <KeyboardAvoidingView behavior="padding">
        <Text>x</Text>
      </KeyboardAvoidingView>
    );
    expect(UNSAFE_getByType(RNKeyboardAvoidingView).props.behavior).toBe('padding');
  });

  it('every screen with a text input outside a modal renders a KeyboardAvoidingView', () => {
    const offenders = SCREENS.filter(
      (f) => !(rel(f) in TOP_INPUT_ONLY) && inputsWithoutKav(fs.readFileSync(f, 'utf8'))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('the top-input allowlist only names screens that still exist and still need it', () => {
    const stale = Object.keys(TOP_INPUT_ONLY).filter((r) => {
      const f = path.join(ROOT, r);
      return !fs.existsSync(f) || !inputsWithoutKav(fs.readFileSync(f, 'utf8'));
    });
    expect(stale).toEqual([]);
  });

  it('tenant Report Issue keeps its description field inside the KeyboardAvoidingView', () => {
    const src = withoutModals(
      fs.readFileSync(
        path.join(ROOT, 'src/features/tenant/screens/TenantMaintenanceReportScreen.tsx'),
        'utf8'
      )
    );
    const open = src.indexOf('<KeyboardAvoidingView');
    const close = src.lastIndexOf('</KeyboardAvoidingView>');
    const input = src.indexOf('maintenance-description-input');
    const submit = src.indexOf('testID="maintenance-submit"');
    expect(open).toBeGreaterThan(-1);
    expect(input).toBeGreaterThan(open);
    expect(submit).toBeGreaterThan(input);
    expect(close).toBeGreaterThan(submit);
  });

  it('the screen checker ignores inputs inside modals and sees inputs outside them', () => {
    const inModal = '<View><Modal visible><TextInput /></Modal></View>';
    const outside = '<View><TextInput /></View>';
    const wrapped = '<KeyboardAvoidingView><TextInput /></KeyboardAvoidingView>';
    expect(inputsWithoutKav(inModal)).toBe(false);
    expect(inputsWithoutKav(outside)).toBe(true);
    expect(inputsWithoutKav(wrapped)).toBe(false);
    expect(inputsWithoutKav('<Input value={v} />')).toBe(true);
  });

  it('forms inside a KeyboardAvoidingView scroll with KeyboardAwareScrollView', () => {
    // the KAV shrinks the form after the keyboard is up; a plain ScrollView
    // then leaves the field being typed in below the visible area (device run:
    // Report Issue title hidden while typing)
    const offenders = FILES.filter((f) => {
      if (rel(f) in OWN_REVEAL) return false;
      const src = fs.readFileSync(f, 'utf8');
      return verticalScrollViews(insideKav(src)) > 0;
    }).map(rel);
    expect(offenders).toEqual([]);
  });

  it('the own-reveal allowlist still names screens that need it', () => {
    for (const r of Object.keys(OWN_REVEAL)) {
      expect(fs.readFileSync(path.join(ROOT, r), 'utf8')).toContain('useRevealAboveKeyboard');
    }
  });

  it('tenant Report Issue fields scroll with KeyboardAwareScrollView', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/features/tenant/screens/TenantMaintenanceReportScreen.tsx'),
      'utf8'
    );
    const open = src.indexOf('<KeyboardAwareScrollView');
    const close = src.indexOf('</KeyboardAwareScrollView>');
    expect(open).toBeGreaterThan(-1);
    for (const id of ['maintenance-title-input', 'maintenance-description-input']) {
      expect(src.indexOf(id)).toBeGreaterThan(open);
      expect(src.indexOf(id)).toBeLessThan(close);
    }
  });

  it('no footer is pinned over a keyboard-aware form (it hid the field being typed in)', () => {
    // an absolute bottom footer covers the end of the scroll view, so a field
    // scrolled "above the keyboard" was still behind Submit (device: Report Issue)
    const offenders = FILES.filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      return /<KeyboardAwareScrollView\b/.test(src) && pinnedFooters(src).length > 0;
    }).map(rel);
    expect(offenders).toEqual([]);
  });

  it('the footer checker finds pinned footers, not full-screen overlays', () => {
    const footer = `  footer: {\n    position: 'absolute',\n    bottom: 0,\n    left: 0,\n  },`;
    const overlay = `  overlay: {\n    position: 'absolute',\n    top: 0,\n    bottom: 0,\n  },`;
    expect(pinnedFooters(`const styles = StyleSheet.create({\n${footer}\n});`)).toEqual(['footer']);
    expect(pinnedFooters(`const styles = StyleSheet.create({\n${overlay}\n});`)).toEqual([]);
    expect(pinnedFooters(`<View style={{ position: "absolute", bottom: 0 }} />`)).toEqual([
      'inline style',
    ]);
    expect(
      pinnedFooters(`<View style={[{ position: 'absolute', bottom: 0, left: 0 }, s]} />`)
    ).toEqual(['inline style']);
    expect(
      pinnedFooters(`<View style={[styles.footer, { position: 'absolute', bottom: 0 }]} />`)
    ).toEqual(['inline style']);
  });

  it('the scroll checker counts vertical ScrollViews only', () => {
    expect(verticalScrollViews('<ScrollView style={s}>')).toBe(1);
    expect(
      verticalScrollViews('<ScrollView horizontal showsHorizontalScrollIndicator={false}>')
    ).toBe(0);
    expect(verticalScrollViews('const r = useRef<ScrollView>(null);')).toBe(0);
    expect(verticalScrollViews('<KeyboardAwareScrollView style={s}>')).toBe(0);
    expect(
      insideKav('<ScrollView /><KeyboardAvoidingView><X /></KeyboardAvoidingView>')
    ).not.toContain('ScrollView');
    const twoKavs =
      '<KeyboardAvoidingView><A /></KeyboardAvoidingView><ScrollView /><KeyboardAvoidingView><B /></KeyboardAvoidingView>';
    expect(insideKav(twoKavs)).not.toContain('ScrollView');
    expect(insideKav(twoKavs)).toContain('<B />');
  });

  it('the checker itself catches iOS-only and missing behaviors', () => {
    const iosOnly = `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>`;
    const both = `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>`;
    expect(iosOnlyTags(iosOnly, false)).toBe(1);
    expect(iosOnlyTags('<KeyboardAvoidingView style={s}>', true)).toBe(1);
    expect(iosOnlyTags('<KeyboardAvoidingView style={s}>', false)).toBe(0);
    expect(iosOnlyTags(both, true)).toBe(0);
  });
});
