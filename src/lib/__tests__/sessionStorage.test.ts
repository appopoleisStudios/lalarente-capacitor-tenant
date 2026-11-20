// CT7-067: a SecureStore write that fails or hangs must not lose the session
// supabase-js just stored (it reads it back for every request).
import type * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' } },
}));

let store: jest.Mocked<typeof SecureStore>;
let adapter: typeof import('../supabase').secureStoreAdapter;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  store = require('expo-secure-store');
  adapter = jest.requireActual('../supabase').secureStoreAdapter;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

it('a failed SecureStore write still leaves the session readable', async () => {
  store.setItemAsync.mockRejectedValue(new Error('keystore'));
  await adapter.setItem('sb-session', 'S');
  expect(await adapter.getItem('sb-session')).toBe('S');
});

it('a hung SecureStore write does not block or lose the session', async () => {
  store.setItemAsync.mockReturnValue(new Promise(() => {}));
  await adapter.setItem('sb-session', 'S'); // resolves at once
  expect(await adapter.getItem('sb-session')).toBe('S');
});

it('remove wins over an earlier set, in memory and in SecureStore order', async () => {
  store.setItemAsync.mockResolvedValue(undefined);
  store.deleteItemAsync.mockResolvedValue(undefined);
  await adapter.setItem('k', 'S');
  await adapter.removeItem('k');
  expect(await adapter.getItem('k')).toBeNull();
  await new Promise((r) => setImmediate(r));
  expect(store.setItemAsync.mock.invocationCallOrder[0]).toBeLessThan(
    store.deleteItemAsync.mock.invocationCallOrder[0]
  );
});

it('after an app restart the session is read from SecureStore', async () => {
  store.getItemAsync.mockResolvedValue('persisted');
  expect(await adapter.getItem('sb-session')).toBe('persisted');
});

it('a write during a slow first read is not overwritten by the old value', async () => {
  let finishRead!: (v: string) => void;
  store.getItemAsync.mockReturnValue(new Promise((r) => (finishRead = r)));
  store.setItemAsync.mockResolvedValue(undefined);
  const read = adapter.getItem('k');
  await adapter.setItem('k', 'new');
  finishRead('old');
  expect(await read).toBe('new');
  expect(await adapter.getItem('k')).toBe('new');
});
