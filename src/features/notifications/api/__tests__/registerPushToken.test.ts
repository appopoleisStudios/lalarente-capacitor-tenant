/**
 * A device's push token must follow whoever signs in on it: registration
 * goes through the claim_push_token RPC, not a plain upsert that RLS blocks
 * when a previous user's row was left behind (SA review, #237).
 */
const mockRpc = jest.fn().mockResolvedValue({ error: null });
jest.mock('@/src/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: jest.fn() },
}));
jest.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: jest.fn() },
}));

import notificationsApi from '../notificationsApi';

it('claims the token for the signed-in user via the RPC', async () => {
  await notificationsApi.registerPushToken('user-b', 'ExponentPushToken[abc123xyz]', 'android');
  expect(mockRpc).toHaveBeenCalledWith('claim_push_token', {
    p_token: 'ExponentPushToken[abc123xyz]',
    p_platform: 'android',
  });
});
