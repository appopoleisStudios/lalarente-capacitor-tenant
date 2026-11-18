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

  it('the checker itself catches iOS-only and missing behaviors', () => {
    const iosOnly = `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>`;
    const both = `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>`;
    expect(iosOnlyTags(iosOnly, false)).toBe(1);
    expect(iosOnlyTags('<KeyboardAvoidingView style={s}>', true)).toBe(1);
    expect(iosOnlyTags('<KeyboardAvoidingView style={s}>', false)).toBe(0);
    expect(iosOnlyTags(both, true)).toBe(0);
  });
});
