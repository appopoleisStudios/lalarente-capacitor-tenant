/**
 * Regression tests for the owner dashboard hook:
 * - it loads once an owner id arrives later (sign-out -> sign-in without an
 *   app restart used to leave "Loading dashboard..." on screen forever)
 * - a different owner never sees the previous owner's data
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { useOwnerDashboard } from '../useOwnerDashboard';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { useFocusEffect: (cb: () => void) => useEffect(cb, [cb]) };
});
jest.mock('@/src/core/observability/sentry', () => ({ reportApiError: jest.fn() }));
jest.mock('@/src/shared/utils/dashboardCache', () => ({
  readDashboardCache: jest.fn().mockResolvedValue(null),
  writeDashboardCache: jest.fn(),
}));
jest.mock('../../api/ownerDashboardApi', () => ({ getOwnerDashboardData: jest.fn() }));
const api = jest.requireMock('../../api/ownerDashboardApi') as { getOwnerDashboardData: jest.Mock };

beforeEach(() => jest.clearAllMocks());

it('loads the dashboard when the owner id arrives after mount', async () => {
  api.getOwnerDashboardData.mockResolvedValue({ userName: 'Owner A' });
  const { result, rerender } = renderHook(
    ({ id }: { id: string | null }) => useOwnerDashboard(id),
    {
      initialProps: { id: null as string | null },
    }
  );
  expect(result.current.loading).toBe(true);

  rerender({ id: 'owner-a' });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data).toEqual({ userName: 'Owner A' });
});

it("never shows the previous owner's data after the owner changes", async () => {
  let resolveA: (v: unknown) => void = () => {};
  api.getOwnerDashboardData.mockImplementation((id: string) =>
    id === 'owner-a' ? new Promise((r) => (resolveA = r)) : Promise.resolve({ userName: 'Owner B' })
  );
  const { result, rerender } = renderHook(({ id }: { id: string }) => useOwnerDashboard(id), {
    initialProps: { id: 'owner-a' },
  });

  // Owner B signs in while A's request is still running: B gets its own request.
  rerender({ id: 'owner-b' });
  await waitFor(() => expect(result.current.data).toEqual({ userName: 'Owner B' }));

  // A's late answer must be ignored.
  resolveA({ userName: 'Owner A' });
  await new Promise((r) => setTimeout(r, 0));
  expect(result.current.data).toEqual({ userName: 'Owner B' });
  expect(api.getOwnerDashboardData).toHaveBeenCalledWith('owner-b');
});
