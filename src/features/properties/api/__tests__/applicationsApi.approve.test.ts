// CT7-019 — applicationsApi.approveApplication is a thin wrapper over
// the SECURITY DEFINER `approve_application(app_uuid)` Postgres RPC.
// The RPC enforces the deposit precondition atomically; these tests
// cover the JS adapter: argument shape, error passthrough, happy path.

import { applicationsApi } from '../applicationsApi';

const mockRpc = jest.fn();

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

beforeEach(() => {
  mockRpc.mockReset();
});

describe('applicationsApi.approveApplication — CT7-019 RPC wrapper', () => {
  it('invokes approve_application RPC with the supplied id', async () => {
    mockRpc.mockResolvedValue({
      data: { id: 'app-1', status: 'approved', tenant_id: 't-1' },
      error: null,
    });

    await applicationsApi.approveApplication('app-1');

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('approve_application', { app_uuid: 'app-1' });
  });

  it('forwards the RPC error message to the caller when deposit not paid', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: 'cannot approve: holding deposit is pending — must be paid, applied, or refunded',
      },
    });

    await expect(applicationsApi.approveApplication('app-1')).rejects.toThrow(
      /holding deposit is pending/
    );
  });

  it('forwards the RPC error when there is no deposit at all', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'cannot approve: no holding deposit for this application' },
    });

    await expect(applicationsApi.approveApplication('app-1')).rejects.toThrow(/no holding deposit/);
  });

  it('forwards the auth error when caller is not the owner', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'not authorized to approve this application' },
    });

    await expect(applicationsApi.approveApplication('app-1')).rejects.toThrow(/not authorized/);
  });

  it('returns the updated application row on success (status=approved)', async () => {
    mockRpc.mockResolvedValue({
      data: {
        id: 'app-1',
        status: 'approved',
        reviewed_at: '2026-11-07T07:50:00Z',
        tenant_id: 't-1',
      },
      error: null,
    });

    const result = await applicationsApi.approveApplication('app-1');

    expect(result).toMatchObject({
      id: 'app-1',
      status: 'approved',
      reviewed_at: '2026-11-07T07:50:00Z',
    });
  });

  it('accepts array-wrapped RPC returns (supabase-js variant)', async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: 'app-1', status: 'approved', tenant_id: 't-1' }],
      error: null,
    });

    const result = await applicationsApi.approveApplication('app-1');

    expect(result).toMatchObject({ id: 'app-1', status: 'approved' });
  });

  it('throws a generic message when the RPC returns a non-message error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: {} });

    await expect(applicationsApi.approveApplication('app-1')).rejects.toThrow(
      /Failed to approve application/
    );
  });
});
