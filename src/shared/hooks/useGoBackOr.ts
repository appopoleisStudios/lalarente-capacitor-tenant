import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';

/**
 * Back for a detail screen that lives as a hidden tab (CT7-055).
 *
 * With history it goes back, exactly like Android Back. Without history (the
 * screen was opened cold from a notification or link) it resets the tab
 * navigator to `fallbackTab`, so the list is the only history entry.
 *
 * Neither `router.push` nor `router.replace` / `navigate` to the list works
 * here: with `backBehavior="history"` they leave the detail screen in the tab
 * history, so the next Android Back reopened it.
 */
export function useGoBackOr(fallbackTab: string) {
  const navigation = useNavigation();
  return useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: fallbackTab as never }] });
    }
  }, [navigation, fallbackTab]);
}
