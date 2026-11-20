/**
 * CT7-067: sign-in must not count the user as signed in until supabase-js
 * holds their session and the profile is loaded. setSession() RESOLVES with
 * { error } (stores nothing) when its network check fails; the old
 * fire-and-forget call missed that, and every query then ran without a
 * session ("Welcome back, Tenant", no home).
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth, ATTACH_SESSION_ATTEMPTS } from '../AuthContext';
import { signInErrorMessage } from '@/src/features/auth/utils/signInErrors';

type Listener = (event: string, session: unknown) => void;
let listener: Listener = () => {};
const mockSetSession = jest.fn();
const mockGetSession = jest.fn();
const mockSignOut = jest.fn();
jest.mock('@/src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => mockGetSession(...a),
      setSession: (...a: unknown[]) => mockSetSession(...a),
      signOut: (...a: unknown[]) => mockSignOut(...a),
      onAuthStateChange: jest.fn((cb: Listener) => {
        listener = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
    },
    from: jest.fn(),
  },
}));
jest.mock('@/src/features/maintenance/api/vendors/pendingVendorSelection', () => ({
  clearPendingVendorSelection: jest.fn(),
}));
jest.mock('@/src/shared/utils/dashboardCache', () => ({ clearDashboardCaches: jest.fn() }));
const mockRegisterPush = jest.fn();
jest.mock('@/src/features/notifications/registerPush', () => ({
  unregisterDevicePush: jest.fn(),
  registerDevicePush: (...a: unknown[]) => mockRegisterPush(...a),
}));
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' } },
}));

const USER = { id: 'tenant-1', email: 't@example.com' };
const TOKENS = { access_token: 'at', refresh_token: 'rt', user: USER };
const SESSION = { ...TOKENS, expires_at: 9_999_999_999 };
const noSession = { data: { session: null }, error: null };
const sessionOf = (id: string) => ({ data: { session: { user: { id } } }, error: null });

let profileOk = true;
let profileReads = 0;

/** setSession as supabase-js does it: SIGNED_IN fires BEFORE it returns. */
const setSessionEmitting = () =>
  mockSetSession.mockImplementation(async () => {
    listener('SIGNED_IN', SESSION);
    return { data: { session: SESSION }, error: null };
  });
const setSessionFailing = () =>
  mockSetSession.mockResolvedValue({ data: { session: null }, error: { message: 'fetch failed' } });

beforeEach(() => {
  jest.clearAllMocks();
  profileOk = true;
  profileReads = 0;
  mockGetSession.mockResolvedValue(noSession); // app start: nobody signed in
  mockSignOut.mockImplementation(async () => {
    listener('SIGNED_OUT', null);
    return { error: null };
  });
  global.fetch = jest.fn(async (url: string) => {
    if (String(url).includes('/auth/v1/token')) {
      return { ok: true, json: async () => TOKENS } as Response;
    }
    profileReads++;
    return profileOk
      ? ({ ok: true, json: async () => [{ id: USER.id, role: 'tenant' }] } as Response)
      : ({ ok: false, status: 500, json: async () => ({}) } as Response);
  }) as unknown as typeof fetch;
});

async function renderAuth() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const hook = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

async function signInCatching(result: { current: ReturnType<typeof useAuth> }) {
  let caught: any;
  await act(async () => {
    await result.current.signIn('t@example.com', 'pw').catch((e) => (caught = e));
  });
  return caught;
}

it('setSession resolving { error }: sign-in fails and the app stays signed out', async () => {
  setSessionFailing();
  const { result } = await renderAuth();
  const caught = await signInCatching(result);
  expect(caught?.code).toBe('session_not_attached');
  expect(signInErrorMessage(caught)).toMatch(/Couldn't finish signing in/);
  expect(mockSetSession).toHaveBeenCalledTimes(ATTACH_SESSION_ATTEMPTS);
  expect(result.current.user).toBeNull();
  expect(result.current.session).toBeNull();
  expect(result.current.profile).toBeNull();
});

it('SIGNED_IN from setSession is not trusted when the session was not stored', async () => {
  // SA repro: setSession emits SIGNED_IN, but storage holds no session
  setSessionEmitting();
  const { result } = await renderAuth();
  mockGetSession.mockResolvedValue(noSession);
  const caught = await signInCatching(result);
  expect(caught?.code).toBe('session_not_attached');
  expect(result.current.user).toBeNull();
  expect(result.current.profile).toBeNull();
  expect(mockSignOut).toHaveBeenLastCalledWith({ scope: 'local' }); // half state cleared
});

it('a stored session of another user is rejected', async () => {
  setSessionEmitting();
  const { result } = await renderAuth();
  mockGetSession.mockResolvedValue(sessionOf('owner-9'));
  const caught = await signInCatching(result);
  expect(caught?.code).toBe('session_not_attached');
  expect(result.current.user).toBeNull();
});

it('retries once: a blip on the first attach still signs the user in', async () => {
  mockSetSession
    .mockResolvedValueOnce({ data: { session: null }, error: { message: 'fetch failed' } })
    .mockImplementationOnce(async () => {
      listener('SIGNED_IN', SESSION);
      return { data: { session: SESSION }, error: null };
    });
  const { result } = await renderAuth();
  mockGetSession.mockResolvedValue(sessionOf(USER.id));
  await act(async () => {
    await result.current.signIn('t@example.com', 'pw');
  });
  expect(mockSetSession).toHaveBeenCalledTimes(2);
  expect(result.current.user?.id).toBe(USER.id);
  expect(result.current.profile?.id).toBe(USER.id);
});

it('success: user, session and profile published together; profile read once; push registered', async () => {
  setSessionEmitting();
  const { result } = await renderAuth();
  mockGetSession.mockResolvedValue(sessionOf(USER.id));
  await act(async () => {
    await result.current.signIn('t@example.com', 'pw');
  });
  expect(mockSetSession).toHaveBeenCalledWith(TOKENS);
  expect(result.current.user?.id).toBe(USER.id);
  expect(result.current.profile?.id).toBe(USER.id);
  expect(profileReads).toBe(1); // the SIGNED_IN during sign-in did not fetch it again
  await waitFor(() => expect(mockRegisterPush).toHaveBeenCalledWith(USER.id));
});

it('profile cannot be loaded: sign-in fails clearly instead of hanging on "Signing in"', async () => {
  setSessionEmitting();
  profileOk = false;
  const { result } = await renderAuth();
  mockGetSession.mockResolvedValue(sessionOf(USER.id));
  const caught = await signInCatching(result);
  expect(caught?.code).toBe('profile_not_loaded');
  expect(signInErrorMessage(caught)).toMatch(/Couldn't load your account/);
  expect(result.current.user).toBeNull();
});

it('after a failed sign-in, a later attempt works (no stale state)', async () => {
  setSessionFailing();
  const { result } = await renderAuth();
  expect((await signInCatching(result))?.code).toBe('session_not_attached');
  setSessionEmitting();
  mockGetSession.mockResolvedValue(sessionOf(USER.id));
  await act(async () => {
    await result.current.signIn('t@example.com', 'pw');
  });
  expect(result.current.user?.id).toBe(USER.id);
});

it('the auth listener still works outside sign-in (token refresh, sign-out)', async () => {
  const { result } = await renderAuth();
  await act(async () => listener('TOKEN_REFRESHED', SESSION));
  await waitFor(() => expect(result.current.user?.id).toBe(USER.id));
  await act(async () => listener('SIGNED_OUT', null));
  expect(result.current.user).toBeNull();
});

it('sign-up keeps the reason when the account was created but sign-in failed', async () => {
  setSessionFailing();
  (global.fetch as jest.Mock).mockImplementationOnce(async () => ({
    ok: true,
    json: async () => ({ session: { access_token: 'at', refresh_token: 'rt' }, user: USER }),
  }));
  const { result } = await renderAuth();
  let caught: any;
  await act(async () => {
    await result.current
      .signUp('t@example.com', 'pw1234', 'T', 'tenant')
      .catch((e) => (caught = e));
  });
  expect(caught?.code).toBe('session_not_attached');
  expect(caught?.message).toMatch(/account was created/);
  expect(result.current.user).toBeNull();
});
