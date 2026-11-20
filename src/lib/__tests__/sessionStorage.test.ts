// CT7-067: a SecureStore call that fails or hangs must not lose the session
// supabase-js just stored (it reads it back for every request), must not
// stall later writes, and a sign-out must win over an older write.
import type * as SecureStoreT from 'expo-secure-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' } },
}));

type Lib = typeof import('../supabase');
let store: jest.Mocked<typeof SecureStoreT>;
let lib: Lib;
/** what the phone's keystore holds (survives "restarts") */
let native: Map<string, string>;
const hang = () => new Promise<never>(() => {});

function fakeNativeStore() {
  store.getItemAsync.mockImplementation(async (k: string) => native.get(k) ?? null);
  store.setItemAsync.mockImplementation(async (k: string, v: string) => {
    native.set(k, v);
  });
  store.deleteItemAsync.mockImplementation(async (k: string) => {
    native.delete(k);
  });
}

function restartApp() {
  jest.resetModules();
  store = require('expo-secure-store');
  fakeNativeStore();
  lib = jest.requireActual('../supabase');
  // the real client must not run its refresh timer in tests
  lib.supabase.auth.stopAutoRefresh().catch(() => {});
}

beforeEach(() => {
  native = new Map();
  jest.useRealTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  restartApp();
});
afterEach(() => jest.useRealTimers());

const flushMicrotasks = () => new Promise((r) => setImmediate(r));

it('a failed SecureStore write still leaves the session readable', async () => {
  store.setItemAsync.mockRejectedValue(new Error('keystore'));
  await lib.secureStoreAdapter.setItem('sb-session', 'S');
  expect(await lib.secureStoreAdapter.getItem('sb-session')).toBe('S');
});

it('a hung SecureStore write does not block the session', async () => {
  store.setItemAsync.mockReturnValue(hang());
  await lib.secureStoreAdapter.setItem('sb-session', 'S'); // resolves at once
  expect(await lib.secureStoreAdapter.getItem('sb-session')).toBe('S');
});

it('the session survives an app restart', async () => {
  await lib.secureStoreAdapter.setItem('sb-session', 'S');
  await flushMicrotasks();
  restartApp();
  expect(await lib.secureStoreAdapter.getItem('sb-session')).toBe('S');
});

it('hung write → sign-out → restart: the session is gone (later writes are not stalled)', async () => {
  jest.useFakeTimers();
  store.setItemAsync.mockReturnValueOnce(hang()); // first write never answers
  native.set('sb-session', 'OLD');
  await lib.secureStoreAdapter.setItem('sb-session', 'NEW');
  await lib.secureStoreAdapter.removeItem('sb-session'); // sign-out
  await jest.advanceTimersByTimeAsync(lib.SECURE_STORE_TIMEOUT_MS + 10_000);
  expect(store.deleteItemAsync).toHaveBeenCalledWith('sb-session');
  jest.useRealTimers();
  restartApp();
  expect(await lib.secureStoreAdapter.getItem('sb-session')).toBeNull();
});

it('a timed-out write that lands AFTER the sign-out is overwritten again (SA repro)', async () => {
  jest.useFakeTimers();
  let land!: () => void;
  store.setItemAsync.mockImplementationOnce(
    (k: string, v: string) =>
      new Promise<void>((r) => {
        land = () => {
          native.set(k, v); // the native write finally happens
          r();
        };
      })
  );
  await lib.secureStoreAdapter.setItem('sb-session', 'NEW');
  await jest.advanceTimersByTimeAsync(lib.SECURE_STORE_TIMEOUT_MS + 1); // times out
  await lib.secureStoreAdapter.removeItem('sb-session'); // sign-out
  await jest.advanceTimersByTimeAsync(10_000); // delete + retries done
  expect(native.has('sb-session')).toBe(false);
  land(); // the old write lands late and restores the session…
  expect(native.get('sb-session')).toBe('NEW');
  await jest.advanceTimersByTimeAsync(10);
  expect(native.has('sb-session')).toBe(false); // …and is deleted again
  jest.useRealTimers();
  restartApp();
  expect(await lib.secureStoreAdapter.getItem('sb-session')).toBeNull();
});

it('a slow but successful SecureStore does not keep rewriting the same value', async () => {
  jest.useFakeTimers();
  store.setItemAsync.mockImplementation(
    (k: string, v: string) =>
      new Promise<void>(
        (r) =>
          setTimeout(() => {
            native.set(k, v);
            r();
          }, lib.SECURE_STORE_TIMEOUT_MS + 1_000) // always "times out", then succeeds
      )
  );
  await lib.secureStoreAdapter.setItem('k', 'S');
  await jest.advanceTimersByTimeAsync(60_000);
  expect(native.get('k')).toBe('S');
  // first write + at most SECURE_STORE_RETRIES retries, not an endless loop
  expect(store.setItemAsync.mock.calls.length).toBeLessThanOrEqual(1 + lib.SECURE_STORE_RETRIES);
});

it('persists the latest value: an older write never lands after a newer one', async () => {
  await lib.secureStoreAdapter.setItem('k', 'A');
  await lib.secureStoreAdapter.setItem('k', 'B');
  await lib.secureStoreAdapter.removeItem('k');
  await lib.secureStoreAdapter.setItem('k', 'C');
  await flushMicrotasks();
  await flushMicrotasks();
  expect(native.get('k')).toBe('C');
});

it('a failed write is retried with the then-latest value', async () => {
  jest.useFakeTimers();
  store.setItemAsync.mockRejectedValueOnce(new Error('keystore busy'));
  await lib.secureStoreAdapter.setItem('k', 'S');
  await jest.advanceTimersByTimeAsync(5_000);
  expect(native.get('k')).toBe('S');
});

it('a hung cold-start read counts as "no session" instead of hanging', async () => {
  jest.useFakeTimers();
  store.getItemAsync.mockReturnValue(hang());
  const read = lib.secureStoreAdapter.getItem('cold');
  await jest.advanceTimersByTimeAsync(lib.SECURE_STORE_TIMEOUT_MS + 1);
  await expect(read).resolves.toBeNull();
});

it('a write during a slow first read is not overwritten by the old value', async () => {
  let finishRead!: (v: string) => void;
  store.getItemAsync.mockReturnValue(new Promise((r) => (finishRead = r)));
  const read = lib.secureStoreAdapter.getItem('slow');
  await lib.secureStoreAdapter.setItem('slow', 'new');
  finishRead('old');
  expect(await read).toBe('new');
  expect(await lib.secureStoreAdapter.getItem('slow')).toBe('new');
});

it('clearLocalSession removes the session even when the logout call fails (offline)', async () => {
  const key = (lib.supabase.auth as unknown as { storageKey: string }).storageKey;
  await lib.secureStoreAdapter.setItem(key, JSON.stringify({ access_token: 'at' }));
  // what supabase-js does offline: resolves { error } and keeps the session
  const signOut = jest
    .spyOn(lib.supabase.auth, 'signOut')
    .mockResolvedValue({ error: { message: 'Failed to fetch' } } as never);
  await lib.clearLocalSession();
  expect(await lib.secureStoreAdapter.getItem(key)).toBeNull();
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
});
