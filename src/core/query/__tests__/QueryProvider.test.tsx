import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
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

  it('focus-triggered refetch: foreground transition causes stale query to re-execute', async () => {
    // Integration test using the real QueryClient and real focusManager.
    // Verifies that transitioning from background → active causes a stale
    // query to be refetched, which is the central behavior this component enables.
    const {
      QueryClient: RealQueryClient,
      QueryClientProvider: RealQCProvider,
      useQuery: realUseQuery,
      focusManager: realFM,
    } = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');

    const queryFn = jest.fn().mockResolvedValue('result');
    const client = new RealQueryClient({
      defaultOptions: { queries: { staleTime: 0, retry: 0, refetchOnWindowFocus: true } },
    });

    function ObservedQuery() {
      realUseQuery({ queryKey: ['focus-test'], queryFn });
      return null;
    }

    realFM.setFocused(false);
    const { unmount } = render(
      <RealQCProvider client={client}>
        <ObservedQuery />
      </RealQCProvider>
    );

    // Initial fetch (mount)
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    // Simulate app foregrounding — should trigger refetch of the stale query
    realFM.setFocused(true);
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));

    unmount();
    realFM.setFocused(undefined);
    client.clear();
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
