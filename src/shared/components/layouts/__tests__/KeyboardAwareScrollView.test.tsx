/**
 * CT7-051 (device regression): on Android the KeyboardAvoidingView shrinks the
 * form after the keyboard is up, and the field being typed in (tenant Report
 * Issue: Issue Title) was left below the visible area. KeyboardAwareScrollView
 * scrolls the focused input back above the keyboard.
 */
import React from 'react';
import { Keyboard, Platform, ScrollView, Text, TextInput } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { KeyboardAwareScrollView } from '../KeyboardAwareScrollView';
import { REVEAL_DELAY_MS, REVEAL_MARGIN } from '@/src/shared/hooks/useRevealAboveKeyboard';

type Listener = (e?: unknown) => void;
let listeners: Record<string, Listener[]>;
let keyboardVisible: boolean;
let focused: unknown;

const KEYBOARD_TOP = 1100;
// shrunk scroll view 300..1100; the focused title input ended up at 1150..1250
const FRAME = { y: 300, h: 800 };
const INPUT = { y: 1150, h: 100 };
const OVERFLOW = INPUT.y + INPUT.h + REVEAL_MARGIN - KEYBOARD_TOP;

const realOS = Platform.OS;

function input({ inside = true, y = INPUT.y, h = INPUT.h, deferred = [] as (() => void)[] } = {}) {
  return {
    measureLayout: (_rel: unknown, ok: () => void, fail: () => void) => (inside ? ok() : fail()),
    measureInWindow: (cb: (...a: number[]) => void) => deferred.push(() => cb(0, y, 400, h)),
  };
}

function mount(onScroll?: jest.Mock) {
  const ref = React.createRef<ScrollView>();
  const utils = render(
    <KeyboardAwareScrollView ref={ref} testID="form" onScroll={onScroll}>
      <Text>form</Text>
    </KeyboardAwareScrollView>
  );
  const scrollTo = jest.fn();
  Object.assign(ref.current as object, {
    scrollTo,
    measureInWindow: (cb: (...a: number[]) => void) => cb(0, FRAME.y, 400, FRAME.h),
  });
  return { ...utils, scrollTo };
}

function keyboardShows() {
  keyboardVisible = true;
  (listeners.keyboardDidShow ?? []).forEach((l) =>
    l({ endCoordinates: { screenY: KEYBOARD_TOP } })
  );
}

const tick = () => act(() => jest.advanceTimersByTime(REVEAL_DELAY_MS));

beforeEach(() => {
  jest.useFakeTimers();
  listeners = {};
  keyboardVisible = false;
  focused = null;
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, l: Listener) => {
    (listeners[name] ??= []).push(l);
    return { remove: () => (listeners[name] = listeners[name].filter((x) => x !== l)) };
  }) as unknown as typeof Keyboard.addListener);
  jest.spyOn(Keyboard, 'isVisible').mockImplementation(() => keyboardVisible);
  jest
    .spyOn(TextInput.State, 'currentlyFocusedInput')
    .mockImplementation(() => focused as ReturnType<typeof TextInput.State.currentlyFocusedInput>);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true });
});

describe('KeyboardAwareScrollView (CT7-051)', () => {
  it('scrolls the focused input back above the keyboard once the form has shrunk', () => {
    const deferred: (() => void)[] = [];
    focused = input({ deferred });
    const { scrollTo } = mount();
    keyboardShows();
    tick();
    deferred.forEach((d) => d());
    expect(scrollTo).toHaveBeenCalledWith({ y: OVERFLOW, animated: true });
  });

  it('adds to the current scroll offset and still calls the caller’s onScroll', () => {
    const deferred: (() => void)[] = [];
    focused = input({ deferred });
    const onScroll = jest.fn();
    const { getByTestId, scrollTo } = mount(onScroll);
    fireEvent.scroll(getByTestId('form'), { nativeEvent: { contentOffset: { y: 250 } } });
    expect(onScroll).toHaveBeenCalled();
    keyboardShows();
    tick();
    deferred.forEach((d) => d());
    expect(scrollTo).toHaveBeenCalledWith({ y: 250 + OVERFLOW, animated: true });
  });

  it('leaves a focused input that is already visible alone', () => {
    const deferred: (() => void)[] = [];
    focused = input({ deferred, y: 600 });
    const { scrollTo } = mount();
    keyboardShows();
    tick();
    deferred.forEach((d) => d());
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('ignores a focused input that is not inside this scroll view (another screen, a modal)', () => {
    const deferred: (() => void)[] = [];
    focused = input({ deferred, inside: false });
    const { scrollTo } = mount();
    keyboardShows();
    tick();
    deferred.forEach((d) => d());
    expect(deferred).toHaveLength(0);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('drops the scroll when the keyboard closes before it runs', () => {
    focused = input();
    const { scrollTo } = mount();
    keyboardShows();
    keyboardVisible = false;
    (listeners.keyboardDidHide ?? []).forEach((l) => l());
    tick();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('drops a measurement in flight when focus moved meanwhile', () => {
    const deferred: (() => void)[] = [];
    focused = input({ deferred });
    const { scrollTo } = mount();
    keyboardShows();
    tick();
    focused = input(); // user tapped another field
    deferred.forEach((d) => d());
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('stops listening when unmounted', () => {
    focused = input();
    const { unmount, scrollTo } = mount();
    unmount();
    expect(listeners.keyboardDidShow ?? []).toHaveLength(0);
    keyboardShows();
    tick();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does nothing on iOS (behavior there is unchanged)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    focused = input();
    mount();
    expect(listeners.keyboardDidShow ?? []).toHaveLength(0);
  });
});
