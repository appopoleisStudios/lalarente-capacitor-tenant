import { supabase } from '@/src/lib/supabase';

export type TableResult = { data: unknown; error: unknown };
export type QueryRecord = { eq: Array<[string, unknown]>; in: Array<[string, unknown[]]> };
export type MockCapture = Record<string, QueryRecord[]>;

const defaults: Record<string, TableResult> = {
  profiles: { data: { full_name: 'Test User' }, error: null },
  leases: { data: null, error: null },
  maintenance_requests: { data: [], error: null },
  viewing_requests: { data: [], error: null },
  rental_applications: { data: [], error: null },
  inspections: { data: null, error: null },
  notifications: { data: [], error: null },
};

export const makeSupabaseMock = (
  overrides: Record<string, TableResult | TableResult[]> = {}
): MockCapture => {
  const callCounts: Record<string, number> = {};
  const capture: MockCapture = {};

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
