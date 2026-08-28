import { bootstrapVendorMaintenanceThread } from '../vendorThreadApi';

const mockRpc = jest.fn();

jest.mock('@/src/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe('bootstrapVendorMaintenanceThread', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('returns the authorized thread id from the RPC', async () => {
    mockRpc.mockResolvedValue({ data: 'thread-1', error: null });

    await expect(
      bootstrapVendorMaintenanceThread('request-1', 'Discussing invoice INV-1')
    ).resolves.toBe('thread-1');
    expect(mockRpc).toHaveBeenCalledWith('bootstrap_vendor_maintenance_thread', {
      p_request_id: 'request-1',
      p_initial_message: 'Discussing invoice INV-1',
    });
  });

  it('surfaces the database authorization error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Only the assigned vendor can start this conversation' },
    });

    await expect(bootstrapVendorMaintenanceThread('request-1', 'Hello')).rejects.toThrow(
      'Only the assigned vendor'
    );
  });

  it('rejects an empty RPC response', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(bootstrapVendorMaintenanceThread('request-1', 'Hello')).rejects.toThrow(
      'no thread returned'
    );
  });
});
