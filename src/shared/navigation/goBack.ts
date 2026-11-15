// CT7-033: back always returns to the screen the user came from. Only when
// there is no history (opened from a notification/deep link, or after a
// replace) does it go to a sensible parent screen instead.
import type { Router } from 'expo-router';

export function goBack(router: Pick<Router, 'back' | 'canGoBack' | 'navigate'>, fallback: string) {
  if (router.canGoBack()) router.back();
  else router.navigate(fallback as never);
}
