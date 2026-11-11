import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { supabase } from '@/src/lib/supabase';
import { paymentsApi } from '../../../properties/api/paymentsApi';
import { messagesApi } from '../../../messaging/api/messagesApi';
import { useTenantDashboard } from '../useTenantDashboard';

jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn(), auth: {} } }));
jest.mock('../../../properties/api/paymentsApi', () => ({
  paymentsApi: { getTenantPayments: jest.fn() },
}));
jest.mock('../../../messaging/api/messagesApi', () => ({
  messagesApi: { getUserThreads: jest.fn() },
}));
jest.mock('../../utils/profileCompleteness', () => ({
  checkTenantProfileCompleteness: jest
    .fn()
    .mockResolvedValue({ status: 'ok', complete: true, missing: [] }),
}));

type TableResult = { data: unknown; error: unknown };
type QueryRecord = { eq: Array<[string, unknown]>; in: Array<[string, unknown[]]> };
type MockCapture = Record<string, QueryRecord[]>;

const makeSupabaseMock = (
  overrides: Record<string, TableResult | TableResult[]> = {}
): MockCapture => {
  const callCounts: Record<string, number> = {};
  const capture: MockCapture = {};
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

    const qr: QueryRecord = { eq: [], in: [] };
    if (!capture[table]) capture[table] = [];
    capture[table].push(qr);

    let limitN: number | undefined;
    const gteFilters: Array<{ column: string; value: string }> = [];
    const orderBys: Array<{ column: string; ascending: boolean }> = [];

    const resolved = () => {
      let data = result.data;
      if (Array.isArray(data)) {
        for (const f of gteFilters) {
          data = (data as Record<string, unknown>[]).filter(
            (row) => String(row[f.column] ?? '') >= f.value
          );
        }
        if (orderBys.length > 0) {
          for (const o of orderBys) {
            data = [...(data as Record<string, unknown>[])].sort((a, b) => {
              const av = String(a[o.column] ?? '');
              const bv = String(b[o.column] ?? '');
              return o.ascending ? av.localeCompare(bv) : bv.localeCompare(av);
            });
          }
        }
        if (limitN !== undefined) return { ...result, data: (data as unknown[]).slice(0, limitN) };
        return { ...result, data };
      }
      return result;
    };

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        qr.eq.push([column, value]);
        return chain;
      },
      in: (column: string, values: unknown[]) => {
        qr.in.push([column, values as unknown[]]);
        return chain;
      },
      not: () => chain,
      is: () => chain,
      gte: (column: string, value: unknown) => {
        gteFilters.push({ column, value: String(value) });
        return chain;
      },
      order: (column: string, opts?: { ascending?: boolean }) => {
        orderBys.push({ column, ascending: opts?.ascending ?? true });
        return chain;
      },
      limit: (n: number) => {
        limitN = n;
        return chain;
      },
      maybeSingle: () => Promise.resolve(resolved()),
      single: () => Promise.resolve(resolved()),
    };
    (chain as Record<string, unknown>).then = (
      onFulfilled: ((v: unknown) => unknown) | null | undefined,
      onRejected: ((e: unknown) => unknown) | null | undefined
    ) => Promise.resolve(resolved()).then(onFulfilled, onRejected);
    return chain;
  });

  return capture;
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

  it('all viewing_requests queries filter by tenant_id', async () => {
    const captured = makeSupabaseMock();
    const { result } = renderHook(() => useTenantDashboard('user-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const viewingQueries = captured['viewing_requests'] ?? [];
    // The hook issues two queries: approved/pending and declined — both must scope to userId.
    expect(viewingQueries.length).toBeGreaterThanOrEqual(2);
    expect(
      viewingQueries.every((q) => q.eq.some(([col, val]) => col === 'tenant_id' && val === 'user-1'))
    ).toBe(true);
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

    it('caps at 3 even when more future viewings exist — historical rows must not crowd out future', async () => {
      // 3 historical rows followed by 4 future rows in DB order. If SQL LIMIT(3) ran
      // before client-side filtering, all 3 historical rows would fill the buffer and
      // no future appointments would be returned.
      const historical = [
        { id: 'h1', requested_date: '2020-01-01', confirmed_date: null, status: 'approved' },
        { id: 'h2', requested_date: '2020-02-01', confirmed_date: null, status: 'approved' },
        { id: 'h3', requested_date: '2020-03-01', confirmed_date: null, status: 'approved' },
      ];
      const future4 = [
        { id: 'f1', requested_date: '2099-01-01', confirmed_date: null, status: 'approved' },
        { id: 'f2', requested_date: '2099-02-01', confirmed_date: null, status: 'approved' },
        { id: 'f3', requested_date: '2099-03-01', confirmed_date: null, status: 'approved' },
        { id: 'f4', requested_date: '2099-04-01', confirmed_date: null, status: 'approved' },
      ];
      makeSupabaseMock({
        viewing_requests: [
          { data: [...historical, ...future4], error: null },
          { data: [], error: null },
        ],
      });
      const { result } = renderHook(() => useTenantDashboard('user-1'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const ids = result.current.data!.upcomingViewings.map((v: any) => v.id);
      expect(ids).toHaveLength(3);
      expect(ids).not.toContain('h1');
      expect(ids).not.toContain('h2');
      expect(ids).not.toContain('h3');
      expect(ids).toContain('f1');
      expect(ids).toContain('f2');
      expect(ids).toContain('f3');
    });

    it('returns 3 nearest future appointments from an unordered list', async () => {
      // Provided furthest-first to verify ascending order is applied before slicing.
      const unordered = [
        { id: 'far', requested_date: '2099-12-01', confirmed_date: null, status: 'approved' },
        { id: 'near1', requested_date: '2099-01-01', confirmed_date: null, status: 'approved' },
        { id: 'near2', requested_date: '2099-02-01', confirmed_date: null, status: 'approved' },
        { id: 'near3', requested_date: '2099-03-01', confirmed_date: null, status: 'approved' },
      ];
      makeSupabaseMock({
        viewing_requests: [
          { data: unordered, error: null },
          { data: [], error: null },
        ],
      });
      const { result } = renderHook(() => useTenantDashboard('user-1'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const ids = result.current.data!.upcomingViewings.map((v: any) => v.id);
      expect(ids).toHaveLength(3);
      expect(ids[0]).toBe('near1');
      expect(ids[1]).toBe('near2');
      expect(ids[2]).toBe('near3');
      expect(ids).not.toContain('far');
    });
  });
});
