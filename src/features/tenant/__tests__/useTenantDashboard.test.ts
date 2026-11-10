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

type TableResult = { data: unknown; error: unknown };

// Tracks call counts per table so sequential calls to the same table can
// return different results (e.g., viewing_requests called twice: once for
// upcoming, once for declined).
const makeSupabaseMock = (overrides: Record<string, TableResult | TableResult[]> = {}) => {
  const callCounts: Record<string, number> = {};
  const defaults: Record<string, TableResult> = {
    profiles: { data: { full_name: 'Test User' }, error: null },
    leases: { data: null, error: null },
    maintenance_requests: { data: [], error: null },
    viewing_requests: { data: [], error: null },
    rental_applications: { data: [], error: null },
    inspections: { data: null, error: null },
    notifications: { data: [], error: null },
  };

  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    callCounts[table] = (callCounts[table] ?? 0) + 1;
    const override = overrides[table];
    let result: TableResult;
    if (Array.isArray(override)) {
      result = override[(callCounts[table] - 1) % override.length];
    } else {
      result = override ?? defaults[table] ?? { data: null, error: null };
    }
    const chain: Record<string, unknown> = {
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
    };
    (chain as Record<string, unknown>).then = Promise.resolve(result).then.bind(
      Promise.resolve(result)
    );
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

  it('enters error state when declined viewings query fails', async () => {
    // viewing_requests is called twice: first for upcoming (call 1 — succeeds),
    // second for declined (call 2 — fails).
    makeSupabaseMock({
      viewing_requests: [
        { data: [], error: null },
        { data: null, error: { message: 'rls violation' } },
      ],
    });
    const { result } = renderHook(() => useTenantDashboard('user-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/viewing_requests.*declined/);
  });

  it('is disabled when userId is null', () => {
    makeSupabaseMock();
    const { result } = renderHook(() => useTenantDashboard(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  describe('upcomingViewings filtering', () => {
    const futureViewing = {
      id: 'v1',
      requested_date: '2099-01-01',
      confirmed_date: null,
      status: 'approved',
    };
    const pastViewing = {
      id: 'v2',
      requested_date: '2020-01-01',
      confirmed_date: null,
      status: 'approved',
    };
    // Rescheduled: original date was past, confirmed date is future
    const rescheduledFuture = {
      id: 'v3',
      requested_date: '2020-01-01',
      confirmed_date: '2099-06-01',
      status: 'approved',
    };
    // Rescheduled: original date was future, confirmed date is past
    const rescheduledPast = {
      id: 'v4',
      requested_date: '2099-01-01',
      confirmed_date: '2020-06-01',
      status: 'approved',
    };

    it('excludes past appointments and keeps future ones', async () => {
      makeSupabaseMock({
        viewing_requests: [
          { data: [futureViewing, pastViewing], error: null },
          { data: [], error: null },
        ],
      });
      const { result } = renderHook(() => useTenantDashboard('user-1'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const ids = result.current.data!.upcomingViewings.map((v: any) => v.id);
      expect(ids).toContain('v1');
      expect(ids).not.toContain('v2');
    });

    it('uses confirmed_date when rescheduled (past→future should include)', async () => {
      makeSupabaseMock({
        viewing_requests: [
          { data: [rescheduledFuture], error: null },
          { data: [], error: null },
        ],
      });
      const { result } = renderHook(() => useTenantDashboard('user-1'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const ids = result.current.data!.upcomingViewings.map((v: any) => v.id);
      expect(ids).toContain('v3');
    });

    it('uses confirmed_date when rescheduled (future→past should exclude)', async () => {
      makeSupabaseMock({
        viewing_requests: [
          { data: [rescheduledPast], error: null },
          { data: [], error: null },
        ],
      });
      const { result } = renderHook(() => useTenantDashboard('user-1'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const ids = result.current.data!.upcomingViewings.map((v: any) => v.id);
      expect(ids).not.toContain('v4');
    });

    it('returns only future viewings from a mixed list', async () => {
      const mixed = [futureViewing, pastViewing, rescheduledFuture, rescheduledPast];
      makeSupabaseMock({
        viewing_requests: [
          { data: mixed, error: null },
          { data: [], error: null },
        ],
      });
      const { result } = renderHook(() => useTenantDashboard('user-1'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const ids = result.current.data!.upcomingViewings.map((v: any) => v.id);
      expect(ids).toEqual(expect.arrayContaining(['v1', 'v3']));
      expect(ids).not.toContain('v2');
      expect(ids).not.toContain('v4');
    });
  });
});
