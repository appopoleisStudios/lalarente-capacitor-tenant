import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { supabase } from '@/src/lib/supabase';
import { paymentsApi } from '../../properties/api/paymentsApi';
import { messagesApi } from '../../messaging/api/messagesApi';
import { useTenantDashboard } from '../hooks/useTenantDashboard';

jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: {} } }));
jest.mock('../../properties/api/paymentsApi', () => ({
  paymentsApi: { getTenantPayments: jest.fn() },
}));
jest.mock('../../messaging/api/messagesApi', () => ({
  messagesApi: { getUserThreads: jest.fn() },
}));
jest.mock('../utils/profileCompleteness', () => ({
  checkTenantProfileCompleteness: jest
    .fn()
    .mockResolvedValue({ status: 'ok', complete: true, missing: [] }),
}));

const makeSupabaseMock = (overrides: Record<string, { data: unknown; error: unknown }> = {}) => {
  const defaults: Record<string, { data: unknown; error: null }> = {
    profiles: { data: { full_name: 'Test User' }, error: null },
    leases: { data: null, error: null },
    maintenance_requests: { data: [], error: null },
    viewing_requests: { data: [], error: null },
    rental_applications: { data: [], error: null },
    inspections: { data: null, error: null },
    notifications: { data: [], error: null },
  };

  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    const result = overrides[table] ?? defaults[table] ?? { data: null, error: null };
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      not: () => chain,
      is: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => Promise.resolve(result),
      single: () => Promise.resolve(result),
      then: undefined as unknown,
    };
    chain.then = Promise.resolve(result).then.bind(Promise.resolve(result));
    return chain;
  });
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  (paymentsApi.getTenantPayments as jest.Mock).mockResolvedValue([]);
  (messagesApi.getUserThreads as jest.Mock).mockResolvedValue([]);
});

describe('useTenantDashboard', () => {
  it('succeeds and returns userName from profile', async () => {
    makeSupabaseMock();
    const { result } = renderHook(() => useTenantDashboard('user-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.userName).toBe('Test User');
  });

  it('enters error state when leases query fails', async () => {
    makeSupabaseMock({ leases: { data: null, error: { message: 'permission denied' } } });
    const { result } = renderHook(() => useTenantDashboard('user-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/leases/);
  });

  it('enters error state when maintenance_requests query fails', async () => {
    makeSupabaseMock({ maintenance_requests: { data: null, error: { message: 'rls violation' } } });
    const { result } = renderHook(() => useTenantDashboard('user-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/maintenance_requests/);
  });

  it('is disabled when userId is null', () => {
    makeSupabaseMock();
    const { result } = renderHook(() => useTenantDashboard(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });
});
