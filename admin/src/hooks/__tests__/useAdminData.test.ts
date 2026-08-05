import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminData } from '../useAdminData';

// Mock the supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from '../../lib/supabaseClient';

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAdminData', () => {
  it('calls the correct RPC function name', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: '1' }], error: null });

    renderHook(() => useAdminData('admin_get_properties'));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('admin_get_properties', {});
    });
  });

  it('returns data when RPC succeeds', async () => {
    const testData = [{ id: '1', title: 'Test Property' }];
    mockRpc.mockResolvedValue({ data: testData, error: null });

    const { result } = renderHook(() => useAdminData('admin_get_properties'));

    await waitFor(() => {
      expect(result.current.data).toEqual(testData);
    });
  });

  it('sets error when RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('DB error') });

    const { result } = renderHook(() => useAdminData('admin_get_properties'));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeNull();
    });
  });

  it('starts in loading state', () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useAdminData('admin_get_properties'));

    expect(result.current.loading).toBe(true);
  });

  it('completes loading after fetch', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: '1' }], error: null });

    const { result } = renderHook(() => useAdminData('admin_get_properties'));

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('refetch calls the RPC again', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: '1' }], error: null });

    const { result } = renderHook(() => useAdminData('admin_get_properties'));

    await waitFor(() => {
      expect(result.current.data).toEqual([{ id: '1' }]);
    });

    mockRpc.mockResolvedValue({ data: [{ id: '2' }], error: null });
    result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toEqual([{ id: '2' }]);
    });
  });

  it('passes params to the RPC call', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    renderHook(() => useAdminData('admin_toggle_dev_admin', { target_user_id: 'abc' }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('admin_toggle_dev_admin', {
        target_user_id: 'abc',
      });
    });
  });

  it('does not call the RPC when enabled is false', async () => {
    renderHook(() => useAdminData('admin_get_vendor_transaction_detail', undefined, false));

    // Give the effect a chance to run — the RPC must never fire.
    await new Promise((r) => setTimeout(r, 50));
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('fires the RPC when enabled flips from false to true', async () => {
    mockRpc.mockResolvedValue({ data: { id: 'x' }, error: null });

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAdminData(
          'admin_get_vendor_transaction_detail',
          enabled ? { p_payment_id: 'abc' } : undefined,
          enabled
        ),
      { initialProps: { enabled: false } }
    );

    // While disabled: no RPC, not loading.
    await new Promise((r) => setTimeout(r, 50));
    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);

    // Enable -> refetch fires with the real params.
    rerender({ enabled: true });
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('admin_get_vendor_transaction_detail', {
        p_payment_id: 'abc',
      });
      expect(result.current.data).toEqual({ id: 'x' });
    });
  });
});
