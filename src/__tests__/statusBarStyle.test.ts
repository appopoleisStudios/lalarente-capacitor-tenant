/**
 * CT7-049: Android draws edge-to-edge with a transparent status bar, and the
 * theme does not ask for dark icons, so without an app-wide StatusBar the
 * clock / battery / signal were white on the app's white screens.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

describe('status bar icons stay visible (CT7-049)', () => {
  it('the root layout sets dark status-bar icons for the whole app', () => {
    const src = fs.readFileSync(path.join(ROOT, 'app', '_layout.tsx'), 'utf8');
    expect(src).toMatch(/import \{ StatusBar \} from 'expo-status-bar'/);
    expect(src).toMatch(/<StatusBar style="dark" \/>/);
  });
});
