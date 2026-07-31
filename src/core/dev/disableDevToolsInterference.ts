import { LogBox, NativeModules, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/**
 * Stop React Native DevTools / the developer menu from hijacking Maestro runs.
 *
 * Causes we hit in practice:
 * 1. iOS Simulator treats process relaunch / some automation as a "shake" → Dev Menu
 * 2. Maestro taps the yellow LogBox "Open debugger to view warnings" strip → DevTools
 * 3. Expo floating tools FAB / three-finger long-press (when present) → Dev Menu → DevTools
 *
 * Keyboard shortcuts (Cmd+D / `j` in Metro) still open debugging when you want them.
 */
export function disableDevToolsInterference(): void {
  if (!__DEV__) return;

  // Yellow banner that opens DevTools when tapped (common Maestro false-positive).
  LogBox.ignoreLogs(['Open debugger to view warnings']);

  try {
    NativeModules.DevSettings?.setIsShakeToShowDevMenuEnabled?.(false);
  } catch {
    // Native module unavailable (web / production-shaped binary).
  }

  try {
    const DevMenuPreferences = requireOptionalNativeModule('DevMenuPreferences') as {
      setPreferencesAsync?: (prefs: Record<string, boolean>) => Promise<void>;
    } | null;
    void DevMenuPreferences?.setPreferencesAsync?.({
      showFloatingActionButton: false,
      motionGestureEnabled: false,
      touchGestureEnabled: false,
      showsAtLaunch: false,
      isOnboardingFinished: true,
    });
  } catch {
    // Expo module bridge unavailable.
  }

  if (Platform.OS === 'android') {
    try {
      NativeModules.DevSettings?.setIsShakeToShowDevMenuEnabled?.(false);
    } catch {
      // ignore
    }
  }
}
