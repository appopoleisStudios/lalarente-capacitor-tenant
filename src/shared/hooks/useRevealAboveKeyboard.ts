import { useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type View,
} from 'react-native';

/** Gap kept between the revealed block and the keyboard. */
export const REVEAL_MARGIN = 16;

/**
 * How far to scroll so a block (`target`, window coords) sits fully inside the
 * visible part of the scroll view (`viewport`, window coords) and above the
 * keyboard's top edge (`keyboardTop`, screen coords). Edge-to-edge Android
 * does not shrink the window for the keyboard, so the scroll view's own frame
 * can extend under it. Returns the new offset, or null when already visible.
 */
export function revealOffset(
  target: { y: number; height: number },
  viewport: { y: number; height: number },
  keyboardTop: number,
  currentOffset: number,
  margin = REVEAL_MARGIN
): number | null {
  const visibleBottom = Math.min(viewport.y + viewport.height, keyboardTop);
  const overflow = target.y + target.height + margin - visibleBottom;
  return overflow > 0 ? currentOffset + overflow : null;
}

/**
 * Keeps a block (e.g. a text box plus the button under it) visible when the
 * keyboard opens. Android only scrolls far enough to show the focused input,
 * so a submit button below it stayed under the keyboard (CT7-050).
 *
 * Attach `scrollRef` + `onScroll` to the ScrollView, `targetRef` to the block,
 * and call `armReveal` from the input's onFocus.
 */
export function useRevealAboveKeyboard() {
  const scrollRef = useRef<ScrollView>(null);
  const targetRef = useRef<View>(null);
  const offset = useRef(0);
  const armed = useRef(false);

  const reveal = useCallback((keyboardTop: number) => {
    const scroll = scrollRef.current;
    const target = targetRef.current;
    if (!scroll || !target) return;
    target.measureInWindow((_tx, ty, _tw, th) => {
      // ScrollView is a host component on both architectures.
      (scroll as unknown as View).measureInWindow((_sx, sy, _sw, sh) => {
        const next = revealOffset(
          { y: ty, height: th },
          { y: sy, height: sh },
          keyboardTop,
          offset.current
        );
        if (next !== null) scroll.scrollTo({ y: next, animated: true });
      });
    });
  }, []);

  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const show = Keyboard.addListener(event, (e) => {
      if (!armed.current) return;
      // let the KAV padding / native focus scroll settle first
      setTimeout(() => reveal(e.endCoordinates.screenY), Platform.OS === 'ios' ? 300 : 100);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      armed.current = false;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [reveal]);

  const armReveal = useCallback(() => {
    armed.current = true;
    // keyboard may already be up (moving focus between inputs)
    const metrics = Keyboard.metrics();
    if (Keyboard.isVisible() && metrics) setTimeout(() => reveal(metrics.screenY), 100);
  }, [reveal]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  return { scrollRef, targetRef, armReveal, onScroll };
}
