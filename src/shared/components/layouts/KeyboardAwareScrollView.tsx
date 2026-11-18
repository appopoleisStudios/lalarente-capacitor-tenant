import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type View,
} from 'react-native';
import { REVEAL_DELAY_MS, revealOffset } from '@/src/shared/hooks/useRevealAboveKeyboard';

type Host = View & {
  measureLayout: (relativeTo: unknown, onSuccess: () => void, onFail: () => void) => void;
};

/**
 * ScrollView for forms inside a KeyboardAvoidingView (CT7-051).
 *
 * On edge-to-edge Android the KeyboardAvoidingView shrinks the form after the
 * keyboard is up. Android only scrolls a field into view when it gains focus,
 * which is before that shrink, so the field being typed in ended up below the
 * visible area (tenant Report Issue: Issue Title hidden while typing). Once
 * the keyboard is up, and again whenever this view is resized while it is up
 * (the shrink can land after keyboardDidShow), this scrolls the focused input
 * back above it, using the same maths as `useRevealAboveKeyboard` (CT7-050).
 *
 * Only an input inside this scroll view counts: `measureLayout` fails for a
 * node that is not a descendant. Focus moving between inputs with the
 * keyboard already up is handled by Android itself (the area is shrunk by then).
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function KeyboardAwareScrollView({ onScroll, onLayout, scrollEventThrottle, ...props }, ref) {
    const scrollRef = useRef<ScrollView>(null);
    useImperativeHandle(ref, () => scrollRef.current as ScrollView);
    const offset = useRef(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // bumped on every cancel, so measurements already in flight are dropped too
    const generation = useRef(0);

    const cancel = useCallback(() => {
      generation.current += 1;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    }, []);

    // keyboard top while it is up (Android), so a later shrink can re-check
    const keyboardTop = useRef<number | null>(null);

    const reveal = useCallback(() => {
      cancel();
      const run = generation.current;
      timer.current = setTimeout(() => {
        timer.current = null;
        const top = keyboardTop.current;
        const scroll = scrollRef.current as unknown as Host | null;
        const input = TextInput.State.currentlyFocusedInput() as unknown as Host | null;
        const stillWanted = () =>
          run === generation.current &&
          Keyboard.isVisible() &&
          TextInput.State.currentlyFocusedInput() === (input as unknown);
        if (top === null || !scroll || !input || !stillWanted()) return;
        input.measureLayout(
          scroll,
          () =>
            input.measureInWindow((_ix, iy, _iw, ih) => {
              scroll.measureInWindow((_sx, sy, _sw, sh) => {
                const next = revealOffset(
                  { y: iy, height: ih },
                  { y: sy, height: sh },
                  top,
                  offset.current
                );
                if (next !== null && stillWanted()) {
                  scrollRef.current?.scrollTo({ y: next, animated: true });
                }
              });
            }),
          () => {} // focused input is not in this scroll view
        );
      }, REVEAL_DELAY_MS);
    }, [cancel]);

    useEffect(() => {
      if (Platform.OS !== 'android') return undefined;
      const show = Keyboard.addListener('keyboardDidShow', (e: KeyboardEvent) => {
        keyboardTop.current = e.endCoordinates.screenY;
        reveal();
      });
      const hide = Keyboard.addListener('keyboardDidHide', () => {
        keyboardTop.current = null;
        cancel();
      });
      return () => {
        show.remove();
        hide.remove();
        cancel();
      };
    }, [reveal, cancel]);

    // The KeyboardAvoidingView may shrink this view only after keyboardDidShow:
    // measure again once the new frame is laid out.
    const handleLayout = useCallback(
      (e: LayoutChangeEvent) => {
        onLayout?.(e);
        if (keyboardTop.current !== null) reveal();
      },
      [onLayout, reveal]
    );

    const handleScroll = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offset.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      },
      [onScroll]
    );

    return (
      <ScrollView
        ref={scrollRef}
        onScroll={handleScroll}
        onLayout={handleLayout}
        scrollEventThrottle={scrollEventThrottle ?? 16}
        {...props}
      />
    );
  }
);
