import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
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
    (focusManager.setFocused as jest.Mock).mockReset();
    Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true });
    addListenerSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove: mockRemove } as any);
  });

  afterEach(() => {
    addListenerSpy.mockRestore();
    (focusManager.setFocused as jest.Mock).mockReset();
    const { focusManager: realFM } =
      jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
    realFM.setFocused(undefined);
    Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true });
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

  it('focus-triggered refetch: AppState listener drives real focusManager which triggers stale query refetch', async () => {
    const { focusManager: realFM } =
      jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');

    (focusManager.setFocused as jest.Mock).mockImplementation((focused: boolean | undefined) =>
      realFM.setFocused(focused)
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useQuery } = require('@tanstack/react-query');
    const queryFn = jest.fn().mockResolvedValue('result');

    function ObservedQuery() {
      useQuery({ queryKey: ['focus-test-appstate'], queryFn, refetchOnWindowFocus: true, staleTime: 0 });
      return null;
    }

    Object.defineProperty(AppState, 'currentState', { value: 'background', writable: true });
    realFM.setFocused(false);

    const { unmount } = render(
      <QueryProvider>
        <ObservedQuery />
      </QueryProvider>
    );

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
    await act(async () => {});

    Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true });
    const listener = addListenerSpy.mock.calls[0][1];
    listener('active');

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    unmount();
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
