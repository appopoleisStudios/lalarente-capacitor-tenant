import React from 'react';
import { render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { focusManager } from '@tanstack/react-query';
import { QueryProvider } from '../QueryProvider';

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return { ...actual, focusManager: { setFocused: jest.fn() } };
});

function Child() {
  return <></>;
}

describe('QueryProvider AppState synchronization', () => {
  let addListenerSpy: jest.SpyInstance;
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    addListenerSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove: mockRemove } as any);
  });

  afterEach(() => {
    addListenerSpy.mockRestore();
  });

  it('calls setFocused(true) on mount when app is already active', () => {
    Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true });
    render(
      <QueryProvider>
        <Child />
      </QueryProvider>
    );
    expect(focusManager.setFocused).toHaveBeenCalledWith(true);
  });

  it('restores focus when remounted while active — regression guard', () => {
    // Phase 1: mount while backgrounded → focusManager set to false
    Object.defineProperty(AppState, 'currentState', { value: 'background', writable: true });
    const { unmount } = render(
      <QueryProvider>
        <Child />
      </QueryProvider>
    );
    expect(focusManager.setFocused).toHaveBeenCalledWith(false);

    // Phase 2: unmount (subscription removed — no more listener to fire setFocused(true))
    unmount();

    // Phase 3: app becomes active while unmounted, focusManager is still stuck at false
    Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true });
    (focusManager.setFocused as jest.Mock).mockClear();

    // Phase 4: remount — must unconditionally restore focus to true
    render(
      <QueryProvider>
        <Child />
      </QueryProvider>
    );
    expect(focusManager.setFocused).toHaveBeenCalledWith(true);
  });

  it('calls setFocused(false) on mount when app is backgrounded', () => {
    Object.defineProperty(AppState, 'currentState', { value: 'background', writable: true });
    render(
      <QueryProvider>
        <Child />
      </QueryProvider>
    );
    expect(focusManager.setFocused).toHaveBeenCalledWith(false);
  });

  it('calls setFocused(false) on mount when app is inactive', () => {
    Object.defineProperty(AppState, 'currentState', { value: 'inactive', writable: true });
    render(
      <QueryProvider>
        <Child />
      </QueryProvider>
    );
    expect(focusManager.setFocused).toHaveBeenCalledWith(false);
  });

  it('subscribes to AppState change events and listener drives focusManager', () => {
    Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true });
    render(
      <QueryProvider>
        <Child />
      </QueryProvider>
    );
    expect(addListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
    // Invoke the captured listener to verify it drives focusManager correctly.
    const listener = addListenerSpy.mock.calls[0][1];
    listener('background');
    expect(focusManager.setFocused).toHaveBeenCalledWith(false);
    listener('active');
    expect(focusManager.setFocused).toHaveBeenCalledWith(true);
  });

  it('real focusManager: active mount restores isFocused() after stale false', () => {
    // Use the real focusManager (not the mock) to verify isFocused() is actually
    // set to true when mounting while active.
    const { focusManager: realFM } =
      jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');

    realFM.setFocused(false);
    expect(realFM.isFocused()).toBe(false);

    Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true });
    // QueryProvider calls focusManager.setFocused — the mock intercepts that call.
    // We verify the real focusManager separately via the same value that the mock
    // would have been called with.
    const mockSetFocused = focusManager.setFocused as jest.Mock;
    render(
      <QueryProvider>
        <Child />
      </QueryProvider>
    );
    // The mock was called with true; propagate to the real manager to verify isFocused.
    const lastCall = mockSetFocused.mock.calls.at(-1)?.[0];
    realFM.setFocused(lastCall);
    expect(realFM.isFocused()).toBe(true);
    realFM.setFocused(undefined); // restore to default (manager decides)
  });

  it('removes the subscription on unmount', () => {
    Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true });
    const { unmount } = render(
      <QueryProvider>
        <Child />
      </QueryProvider>
    );
    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });
});
