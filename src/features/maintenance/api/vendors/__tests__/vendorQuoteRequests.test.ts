import { createQuoteRequests, VendorAlreadyInvitedError } from '../vendorQuoteRequests.api';

const mockGetUser = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/src/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function profilesRoleQuery(role: string) {
  return {
    select: () => ({
      eq: () => ({
        single: async () => ({ data: { role }, error: null }),
      }),
    }),
  };
}

function invitedSelect(vendorIds: string[]) {
  return {
    select: () => ({
      eq: async () => ({
        data: vendorIds.map((vendor_id) => ({ vendor_id })),
        error: null,
      }),
    }),
  };
}

describe('createQuoteRequests', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'owner-1' } }, error: null });
  });

  it('records invited_by owner identity and skips vendors already invited', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesRoleQuery('owner');
      if (table === 'vendor_quote_requests') {
        return {
          select: invitedSelect(['vendor-old']).select,
          insert,
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    await createQuoteRequests('job-1', ['vendor-old', 'vendor-new']);

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        request_id: 'job-1',
        vendor_id: 'vendor-new',
        invited_by: 'owner-1',
        invited_by_role: 'owner',
      }),
    ]);
  });

  it('rejects a duplicate invite when every vendor is already invited', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesRoleQuery('tenant');
      if (table === 'vendor_quote_requests') return invitedSelect(['vendor-1']);
      throw new Error(`unexpected table ${table}`);
    });

    await expect(createQuoteRequests('job-1', ['vendor-1'])).rejects.toBeInstanceOf(
      VendorAlreadyInvitedError
    );
  });

  it('maps unique-constraint failures to VendorAlreadyInvitedError', async () => {
    const insert = jest.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate' } });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesRoleQuery('owner');
      if (table === 'vendor_quote_requests') {
        return {
          select: invitedSelect([]).select,
          insert,
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    await expect(createQuoteRequests('job-1', ['vendor-1'])).rejects.toBeInstanceOf(
      VendorAlreadyInvitedError
    );
  });
});
