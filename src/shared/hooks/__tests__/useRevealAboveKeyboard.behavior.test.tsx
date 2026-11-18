/**
 * CT7-050: behaviour of useRevealAboveKeyboard — when it scrolls, and when a
 * pending scroll must be dropped (hide, blur, unmount).
 */
import { act, renderHook } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { REVEAL_DELAY_MS, REVEAL_MARGIN, useRevealAboveKeyboard } from '../useRevealAboveKeyboard';

type Listener = (e?: unknown) => void;
let listeners: Record<string, Listener[]>;
let removed: number;
let keyboardVisible: boolean;

const KEYBOARD_TOP = 1100;
// block 1050..1250 inside a frame that runs under the keyboard (500..2200)
const TARGET = { y: 1050, h: 200 };
const FRAME = { y: 500, h: 1700 };
const EXPECTED_Y = TARGET.y + TARGET.h + REVEAL_MARGIN - KEYBOARD_TOP;

function setup() {
  const scrollTo = jest.fn();
  const hook = renderHook(() => useRevealAboveKeyboard());
  const r = hook.result.current;
  (r.scrollRef as { current: unknown }).current = {
    scrollTo,
    measureInWindow: (cb: (...a: number[]) => void) => cb(0, FRAME.y, 400, FRAME.h),
  };
  (r.targetRef as { current: unknown }).current = {
    measureInWindow: (cb: (...a: number[]) => void) => cb(0, TARGET.y, 400, TARGET.h),
  };
  return { hook, r, scrollTo };
}

function keyboardShows() {
  keyboardVisible = true;
  const showEvent = Object.keys(listeners).find((k) => k.endsWith('Show'))!;
  listeners[showEvent].forEach((l) => l({ endCoordinates: { screenY: KEYBOARD_TOP } }));
}

function keyboardHides() {
  keyboardVisible = false;
  (listeners.keyboardDidHide ?? []).forEach((l) => l());
}

beforeEach(() => {
  jest.useFakeTimers();
  listeners = {};
  removed = 0;
  keyboardVisible = false;
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, l: Listener) => {
    (listeners[name] ??= []).push(l);
    return { remove: () => (removed += 1) };
  }) as unknown as typeof Keyboard.addListener);
  jest.spyOn(Keyboard, 'isVisible').mockImplementation(() => keyboardVisible);
  jest
    .spyOn(Keyboard, 'metrics')
    .mockImplementation(() =>
      keyboardVisible ? { screenX: 0, screenY: KEYBOARD_TOP, width: 400, height: 1000 } : undefined
    );
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const tick = () => act(() => jest.advanceTimersByTime(REVEAL_DELAY_MS));

describe('useRevealAboveKeyboard (CT7-050)', () => {
  it('focus → keyboard shows → scrolls the block above the keyboard', () => {
    const { r, scrollTo } = setup();
    act(() => r.onFocus());
    act(() => keyboardShows());
    tick();
    expect(scrollTo).toHaveBeenCalledWith({ y: EXPECTED_Y, animated: true });
  });

  it('does nothing when the keyboard opens for another input', () => {
    const { scrollTo } = setup();
    act(() => keyboardShows());
    tick();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('drops the pending scroll when the keyboard hides first', () => {
    const { r, scrollTo } = setup();
    act(() => r.onFocus());
    act(() => keyboardShows());
    act(() => keyboardHides());
    tick();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('reveals again when the keyboard reopens while the input kept focus', () => {
    const { r, scrollTo } = setup();
    act(() => r.onFocus());
    act(() => keyboardShows());
    tick();
    act(() => keyboardHides());
    scrollTo.mockClear();
    act(() => keyboardShows());
    tick();
    expect(scrollTo).toHaveBeenCalledWith({ y: EXPECTED_Y, animated: true });
  });

  it('reveals when focus arrives with the keyboard already up', () => {
    const { r, scrollTo } = setup();
    keyboardVisible = true;
    act(() => r.onFocus());
    tick();
    expect(scrollTo).toHaveBeenCalledWith({ y: EXPECTED_Y, animated: true });
  });

  it('drops the pending scroll on blur', () => {
    const { r, scrollTo } = setup();
    act(() => r.onFocus());
    act(() => keyboardShows());
    act(() => r.onBlur());
    tick();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('removes its listeners and the pending scroll on unmount', () => {
    const { hook, r, scrollTo } = setup();
    act(() => r.onFocus());
    act(() => keyboardShows());
    hook.unmount();
    tick();
    expect(removed).toBe(2);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
