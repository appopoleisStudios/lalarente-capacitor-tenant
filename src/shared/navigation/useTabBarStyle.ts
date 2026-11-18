import type { ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/src/shared/theme/colors';

/** Height of the tab bar's icon + label row, above the bottom inset. */
export const TAB_BAR_CONTENT_HEIGHT = 60;
/** Bottom padding used when the device reports no inset (old Android, no home bar). */
export const TAB_BAR_MIN_BOTTOM = 25;

/**
 * Bottom tab bar style for the owner, tenant and vendor layouts.
 *
 * The bar's height and bottom padding come from the device's real bottom
 * inset. A fixed 85/25 left the labels under the system Back/Home/Recents
 * buttons on Android phones with 3-button navigation (edge-to-edge, inset
 * ~48dp) — CT7-048.
 */
export function useTabBarStyle(): ViewStyle {
  const { bottom } = useSafeAreaInsets();
  const paddingBottom = Math.max(bottom, TAB_BAR_MIN_BOTTOM);
  return {
    backgroundColor: colors.background.default,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    height: TAB_BAR_CONTENT_HEIGHT + paddingBottom,
    paddingBottom,
    paddingTop: 8,
  };
}
