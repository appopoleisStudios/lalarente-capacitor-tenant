/**
 * CT7-049: Android draws edge-to-edge with a transparent status bar, and the
 * theme does not ask for dark icons, so without an app-wide StatusBar the
 * clock / battery / signal were white on the app's white screens. Screens with
 * a dark top area override it only while focused (FocusedStatusBar).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

/** Source without comments, so a commented-out or described tag can't pass. */
function code(rel: string): string {
  return fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('status bar icons stay visible (CT7-049)', () => {
  it('the root layout renders dark status-bar icons for the whole app', () => {
    const src = code('app/_layout.tsx');
    expect(src).toMatch(/import \{ StatusBar \} from 'expo-status-bar'/);
    expect(src).toMatch(/<StatusBar style="dark" \/>/);
  });

  it('the dark 3D tour switches to light icons only while focused', () => {
    const src = code('src/features/properties/screens/PropertyView3DScreen.tsx');
    expect(src).toMatch(/<FocusedStatusBar style="light" \/>/);
  });

  it('the themed not-found screen follows the system theme', () => {
    expect(code('app/+not-found.tsx')).toMatch(/<StatusBar style="auto" \/>/);
  });

  it('the comment stripper ignores a tag that only appears in a comment', () => {
    expect('{/* <StatusBar style="dark" /> */}'.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')).toBe('');
  });
});
