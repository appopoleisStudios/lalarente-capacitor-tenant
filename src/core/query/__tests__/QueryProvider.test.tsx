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

  it('does not call setFocused on mount when app is already active', () => {
    Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true });
    render(
      <QueryProvider>
        <Child />
      </QueryProvider>
    );
    expect(focusManager.setFocused).not.toHaveBeenCalled();
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

  it('subscribes to AppState change events', () => {
    Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true });
    render(
      <QueryProvider>
        <Child />
      </QueryProvider>
    );
    expect(addListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
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
