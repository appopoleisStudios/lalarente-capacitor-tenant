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

  it('the checker itself catches iOS-only and missing behaviors', () => {
    const iosOnly = `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>`;
    const both = `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>`;
    expect(iosOnlyTags(iosOnly, false)).toBe(1);
    expect(iosOnlyTags('<KeyboardAvoidingView style={s}>', true)).toBe(1);
    expect(iosOnlyTags('<KeyboardAvoidingView style={s}>', false)).toBe(0);
    expect(iosOnlyTags(both, true)).toBe(0);
  });
});
