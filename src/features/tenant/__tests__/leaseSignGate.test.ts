// Unit tests for the lease-signing gate (CT7-012).
// SA #194 round 1 required all four outcomes covered:
//   - complete → sign
//   - incomplete → alert with CTA, NOT sign
//   - lookup error → alert, NOT sign (fail-closed)
//   - unauthenticated → alert, NOT sign

import { evaluateSignLeaseGate } from '../utils/leaseSignGate';

const mockGetUser = jest.fn();
const mockCheckTenantProfileCompleteness = jest.fn();

jest.mock('@/src/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  },
}));

jest.mock('../utils/profileCompleteness', () => ({
  checkTenantProfileCompleteness: (...args: unknown[]) =>
    mockCheckTenantProfileCompleteness(...args),
}));

beforeEach(() => {
  mockGetUser.mockReset();
  mockCheckTenantProfileCompleteness.mockReset();
});

describe('evaluateSignLeaseGate', () => {
  it('opens the signature modal when the profile is complete', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockCheckTenantProfileCompleteness.mockResolvedValue({
      status: 'ok',
      complete: true,
      missing: [],
    });

    const decision = await evaluateSignLeaseGate();

    expect(decision).toEqual({ action: 'sign' });
    expect(mockCheckTenantProfileCompleteness).toHaveBeenCalledWith('u1');
  });

  it('blocks and offers a Go to Profile CTA when fields are missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockCheckTenantProfileCompleteness.mockResolvedValue({
      status: 'ok',
      complete: false,
      missing: ['SA ID number', 'Monthly income'],
    });

    const decision = await evaluateSignLeaseGate();

    expect(decision.action).toBe('alert');
    if (decision.action === 'alert') {
      expect(decision.title).toMatch(/complete your profile/i);
      expect(decision.message).toContain('SA ID number');
      expect(decision.message).toContain('Monthly income');
      expect(decision.cta).toEqual({ label: 'Go to Profile', href: '/(tenant)/profile' });
    }
  });

  it('fails CLOSED on lookup error — no signing, no CTA to profile', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockCheckTenantProfileCompleteness.mockResolvedValue({
      status: 'error',
      message: 'connection reset',
    });

    const decision = await evaluateSignLeaseGate();

    expect(decision.action).toBe('alert');
    if (decision.action === 'alert') {
      expect(decision.title).toMatch(/couldn't verify/i);
      expect(decision.message).toContain('connection reset');
      // No Go-to-Profile CTA on lookup error — the user is being asked to retry,
      // not redirected away.
      expect(decision.cta).toBeUndefined();
    }
  });

  it('blocks with sign-in prompt when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const decision = await evaluateSignLeaseGate();

    expect(decision).toEqual({
      action: 'alert',
      title: 'Not signed in',
      message: 'Please sign in again to continue.',
    });
    expect(mockCheckTenantProfileCompleteness).not.toHaveBeenCalled();
  });
});
