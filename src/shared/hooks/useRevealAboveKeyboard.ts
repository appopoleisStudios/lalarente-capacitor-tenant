import { useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  Platform,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type View,
} from 'react-native';

/** Gap kept between the revealed block and the keyboard. */
export const REVEAL_MARGIN = 16;
/** Wait for the KAV resize / native focus scroll to settle before measuring. */
export const REVEAL_DELAY_MS = Platform.OS === 'ios' ? 300 : 100;

/**
 * How far to scroll so a block (`target`) sits fully inside the visible part
 * of the scroll view (`viewport`) and above the keyboard's top edge
 * (`keyboardTop`). Edge-to-edge Android does not shrink the window for the
 * keyboard, so the scroll view's frame can extend under it. All three share
 * one origin: `measureInWindow` and the keyboard's `screenY` coincide for a
 * full-screen app window (Android edge-to-edge, iOS). Returns the new offset,
 * or null when already visible.
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
 * and `onFocus` / `onBlur` to the input.
 */
export function useRevealAboveKeyboard() {
  const scrollRef = useRef<ScrollView>(null);
  const targetRef = useRef<View>(null);
  const offset = useRef(0);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // bumped on every cancel, so measurements already in flight are dropped too
  const generation = useRef(0);

  const cancel = useCallback(() => {
    generation.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const schedule = useCallback(
    (keyboardTop: number) => {
      cancel();
      const run = generation.current;
      // the input may have lost focus or the keyboard closed meanwhile
      const stillWanted = () =>
        run === generation.current && focused.current && Keyboard.isVisible();
      timer.current = setTimeout(() => {
        timer.current = null;
        const scroll = scrollRef.current;
        const target = targetRef.current;
        if (!stillWanted() || !scroll || !target) return;
        target.measureInWindow((_tx, ty, _tw, th) => {
          // ScrollView is a host component on both architectures.
          (scroll as unknown as View).measureInWindow((_sx, sy, _sw, sh) => {
            const next = revealOffset(
              { y: ty, height: th },
              { y: sy, height: sh },
              keyboardTop,
              offset.current
            );
            if (next !== null && stillWanted()) scroll.scrollTo({ y: next, animated: true });
          });
        });
      }, REVEAL_DELAY_MS);
    },
    [cancel]
  );

  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const show = Keyboard.addListener(event, (e: KeyboardEvent) => {
      // also fires when the keyboard reopens while the input kept focus
      if (focused.current) schedule(e.endCoordinates.screenY);
    });
    const hide = Keyboard.addListener('keyboardDidHide', cancel);
    return () => {
      show.remove();
      hide.remove();
      cancel();
    };
  }, [schedule, cancel]);

  const onFocus = useCallback(() => {
    focused.current = true;
    // keyboard already up (focus moved from another input): no show event
    const metrics = Keyboard.metrics();
    if (Keyboard.isVisible() && metrics) schedule(metrics.screenY);
  }, [schedule]);

  const onBlur = useCallback(() => {
    focused.current = false;
    cancel();
  }, [cancel]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  return { scrollRef, targetRef, onFocus, onBlur, onScroll };
}
