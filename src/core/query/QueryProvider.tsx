import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * React Query client with sensible defaults for a mobile app:
 * - staleTime: 30s — don't immediately refetch on mount if data is fresh
 * - gcTime: 5min — keep unused data in cache for 5 minutes (gcTime replaces cacheTime in v5)
 * - retry: 2 — retry failed queries twice before showing error
 * - refetchOnWindowFocus: false — not relevant for mobile (no browser tabs)
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,          // 30 seconds before data is stale
      gcTime: 5 * 60 * 1000,         // 5 minutes garbage collection
      retry: 2,                       // Retry twice on failure
      refetchOnWindowFocus: false,    // Not relevant for React Native
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
