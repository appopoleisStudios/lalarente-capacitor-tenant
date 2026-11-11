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

  it('focus-triggered refetch: AppState listener drives real focusManager which triggers stale query refetch', async () => {
    // Integration test: mounts the actual QueryProvider, invokes the registered
    // AppState listener, and verifies the full chain:
    //   AppState 'active' → QueryProvider listener → focusManager.setFocused(true)
    //   → real internal focusManager notified → stale query refetches.
    const { focusManager: realFM } =
      jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');

    // Bridge mock → real so react-query's internal observers receive the notification.
    (focusManager.setFocused as jest.Mock).mockImplementation((focused: boolean | undefined) =>
      realFM.setFocused(focused)
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useQuery } = require('@tanstack/react-query');
    const queryFn = jest.fn().mockResolvedValue('result');

    function ObservedQuery() {
      // staleTime: 0 so the query is immediately stale after the initial fetch;
      // without it the provider's 30s default keeps the query fresh and foregrounding
      // does not trigger a refetch.
      useQuery({
        queryKey: ['focus-test-appstate'],
        queryFn,
        refetchOnWindowFocus: true,
        staleTime: 0,
      });
      return null;
    }

    Object.defineProperty(AppState, 'currentState', { value: 'background', writable: true });
    realFM.setFocused(false);

    const { unmount } = render(
      <QueryProvider>
        <ObservedQuery />
      </QueryProvider>
    );

    // Wait for initial fetch to complete (not just invoked) so the query is in
    // success state before foregrounding — avoids the race where foregrounding
    // while the request is in-flight reuses the existing request.
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
    await act(async () => {});

    // Foreground via AppState listener — NOT by calling realFM.setFocused directly
    Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true });
    const listener = addListenerSpy.mock.calls[0][1];
    listener('active');

    // AppState listener → focusManager.setFocused(true) → realFM notified → stale query refetches
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));

    unmount();
    realFM.setFocused(undefined);
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
