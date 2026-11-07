// CT7-019 — applicationsApi.approveApplication must reject when the
// holding deposit hasn't cleared. Belt-and-braces beyond the screen's
// client-side Alert (OwnerApplicationDetailScreen).

import { applicationsApi } from '../applicationsApi';

const mockChain = {
  from: jest.fn(),
};

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockChain.from(...args),
  },
}));

/** Build the Supabase builder stub so .eq / .order / .limit / .maybeSingle
 *  resolve to the given result, and .update().eq().select().single()
 *  resolves to the update result. */
function stubSupabase(depositResult: unknown, updateResult: unknown) {
  mockChain.from.mockImplementation((table: string) => {
    if (table === 'holding_deposits') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue(depositResult),
              }),
            }),
          }),
        }),
      };
    }
    // rental_applications
    return {
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(updateResult),
          }),
        }),
      }),
    };
  });
}

beforeEach(() => {
  mockChain.from.mockReset();
});

describe('applicationsApi.approveApplication — CT7-019 holding-deposit gate', () => {
  it('throws when no holding deposit exists for the application', async () => {
    stubSupabase({ data: null, error: null }, { data: null, error: null });
    await expect(applicationsApi.approveApplication('app-1')).rejects.toThrow(/holding deposit/i);
  });

  it('throws when the latest deposit is still pending', async () => {
    stubSupabase({ data: { status: 'pending' }, error: null }, { data: null, error: null });
    await expect(applicationsApi.approveApplication('app-1')).rejects.toThrow(/holding deposit/i);
  });

  it('throws when the latest deposit has expired', async () => {
    stubSupabase({ data: { status: 'expired' }, error: null }, { data: null, error: null });
    await expect(applicationsApi.approveApplication('app-1')).rejects.toThrow(/holding deposit/i);
  });

  it('allows approval when the deposit is paid', async () => {
    stubSupabase(
      { data: { status: 'paid' }, error: null },
      { data: { id: 'app-1', status: 'approved' }, error: null }
    );
    const result = await applicationsApi.approveApplication('app-1');
    expect(result).toMatchObject({ id: 'app-1', status: 'approved' });
  });

  it('allows approval when the deposit is applied', async () => {
    stubSupabase(
      { data: { status: 'applied' }, error: null },
      { data: { id: 'app-1', status: 'approved' }, error: null }
    );
    await expect(applicationsApi.approveApplication('app-1')).resolves.toBeDefined();
  });

  it('surfaces the DB error when the deposit lookup itself fails', async () => {
    stubSupabase(
      { data: null, error: { message: 'connection reset' } },
      { data: null, error: null }
    );
    await expect(applicationsApi.approveApplication('app-1')).rejects.toThrow(
      /Could not verify holding deposit/
    );
  });
});
