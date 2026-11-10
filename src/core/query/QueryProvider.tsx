import React, { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';

function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === 'active');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  useEffect(() => {
    // Synchronize with the current state on mount so an already-backgrounded
    // app doesn't appear active to focusManager until the next change event.
    if (AppState.currentState !== 'active') {
      focusManager.setFocused(false);
    }
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
