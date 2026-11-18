import fs from 'fs';
import path from 'path';
import { renderHook } from '@testing-library/react-native';
import { useTabBarStyle } from '../useTabBarStyle';

let mockBottom = 0;
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: mockBottom, left: 0, right: 0 }),
}));

describe('useTabBarStyle (CT7-048)', () => {
  it('clears the Android 3-button navigation bar', () => {
    mockBottom = 48;
    const { result } = renderHook(() => useTabBarStyle());
    expect(result.current.paddingBottom).toBe(48);
    expect(result.current.height).toBe(60 + 48);
  });

  it('keeps the previous 85/25 bar when the device has no inset', () => {
    mockBottom = 0;
    const { result } = renderHook(() => useTabBarStyle());
    expect(result.current.paddingBottom).toBe(25);
    expect(result.current.height).toBe(85);
  });

  it('never goes below the 25 bottom padding for a small inset, and follows inset changes', () => {
    mockBottom = 16;
    const { result, rerender } = renderHook(() => useTabBarStyle());
    expect(result.current.paddingBottom).toBe(25);
    expect(result.current.height).toBe(85);
    mockBottom = 48;
    rerender({});
    expect(result.current.paddingBottom).toBe(48);
    expect(result.current.height).toBe(108);
  });

  it.each(['owner', 'tenant', 'vendor'])(
    'the %s layout uses it instead of a fixed height',
    (role) => {
      const src = fs.readFileSync(
        path.resolve(__dirname, '..', '..', '..', '..', 'app', `(${role})`, '_layout.tsx'),
        'utf8'
      );
      expect(src).toMatch(/tabBarStyle:\s*tabBarStyle\b/);
      expect(src).not.toMatch(/height:\s*85/);
    }
  );
});
