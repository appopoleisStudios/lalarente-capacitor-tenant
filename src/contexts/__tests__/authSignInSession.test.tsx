/**
 * CT7-067: sign-in must not count the user as signed in until supabase-js
 * holds their session. setSession() RESOLVES with { error } (stores nothing)
 * when its network check fails; the old fire-and-forget call missed that, and
 * every query then ran without a session ("Welcome back, Tenant", no home).
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  AuthProvider,
  useAuth,
  ATTACH_SESSION_ATTEMPTS,
  ATTACH_SESSION_TIMEOUT_MS,
} from '../AuthContext';
import { signInErrorMessage } from '@/src/features/auth/utils/signInErrors';

const mockSetSession = jest.fn();
const mockGetSession = jest.fn();
jest.mock('@/src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => mockGetSession(...a),
      setSession: (...a: unknown[]) => mockSetSession(...a),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
    from: jest.fn(),
  },
}));
jest.mock('@/src/features/maintenance/api/vendors/pendingVendorSelection', () => ({
  clearPendingVendorSelection: jest.fn(),
}));
jest.mock('@/src/shared/utils/dashboardCache', () => ({ clearDashboardCaches: jest.fn() }));
jest.mock('@/src/features/notifications/registerPush', () => ({
  unregisterDevicePush: jest.fn(),
  registerDevicePush: jest.fn(),
}));
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' } },
}));

const USER = { id: 'tenant-1', email: 't@example.com' };
const TOKEN_RESPONSE = { access_token: 'at', refresh_token: 'rt', user: USER };
const sessionFor = (id: string) => ({ data: { session: { user: { id } } }, error: null });
const noSession = { data: { session: null }, error: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue(noSession); // app start: nobody signed in
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/auth/v1/token')) {
      return { ok: true, json: async () => TOKEN_RESPONSE } as Response;
    }
    // profile read
    return { ok: true, json: async () => [{ id: USER.id, full_name: 'Test Tenant' }] } as Response;
  }) as unknown as typeof fetch;
});
afterEach(() => jest.useRealTimers());

async function renderAuth() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const hook = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

it('fails sign-in (and stays signed out) when setSession resolves with an error', async () => {
  mockSetSession.mockResolvedValue({ data: { session: null }, error: { message: 'fetch failed' } });
  const { result } = await renderAuth();
  let caught: any;
  await act(async () => {
    await result.current.signIn('t@example.com', 'pw').catch((e) => (caught = e));
  });
  expect(caught?.code).toBe('session_not_attached');
  expect(signInErrorMessage(caught)).toMatch(/Couldn't finish signing in/);
  expect(mockSetSession).toHaveBeenCalledTimes(ATTACH_SESSION_ATTEMPTS);
  expect(result.current.user).toBeNull();
  expect(result.current.session).toBeNull();
});

it('retries once: a blip on the first attach still signs the user in', async () => {
  mockSetSession
    .mockResolvedValueOnce({ data: { session: null }, error: { message: 'fetch failed' } })
    .mockResolvedValueOnce({ data: { session: {} }, error: null });
  const { result } = await renderAuth();
  mockGetSession.mockResolvedValue(sessionFor(USER.id));
  await act(async () => {
    await result.current.signIn('t@example.com', 'pw');
  });
  expect(mockSetSession).toHaveBeenCalledTimes(2);
  expect(result.current.user?.id).toBe(USER.id);
});

it('sets the user only after supabase-js holds their session', async () => {
  mockSetSession.mockResolvedValue({ data: { session: {} }, error: null });
  const { result } = await renderAuth();
  mockGetSession.mockResolvedValue(sessionFor(USER.id));
  await act(async () => {
    await result.current.signIn('t@example.com', 'pw');
  });
  expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
  expect(result.current.user?.id).toBe(USER.id);
});

it('rejects when the stored session is missing or belongs to someone else', async () => {
  mockSetSession.mockResolvedValue({ data: { session: {} }, error: null });
  const { result } = await renderAuth();
  mockGetSession.mockResolvedValue(sessionFor('owner-9')); // e.g. storage write failed
  let caught: any;
  await act(async () => {
    await result.current.signIn('t@example.com', 'pw').catch((e) => (caught = e));
  });
  expect(caught?.code).toBe('session_not_attached');
  expect(result.current.user).toBeNull();
});

it('a hung setSession cannot hold sign-in forever', async () => {
  const { result } = await renderAuth();
  jest.useFakeTimers();
  mockSetSession.mockReturnValue(new Promise(() => {}));
  let caught: any;
  const p = result.current.signIn('t@example.com', 'pw').catch((e) => (caught = e));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ATTACH_SESSION_TIMEOUT_MS * ATTACH_SESSION_ATTEMPTS + 10);
  });
  await p;
  expect(caught?.code).toBe('session_not_attached');
  // the whole attach stays inside the login screen's 15 s safety timer
  expect(ATTACH_SESSION_TIMEOUT_MS * ATTACH_SESSION_ATTEMPTS).toBeLessThanOrEqual(10_000);
});
