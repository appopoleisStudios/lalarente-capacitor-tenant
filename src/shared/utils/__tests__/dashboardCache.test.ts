/**
 * CT7-056 (SA #261): a dashboard payload cached before a shape change must not
 * be painted — old owner activities had no `route`, and tapping one threw.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearDashboardCaches, readDashboardCache, writeDashboardCache } from '../dashboardCache';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(() => AsyncStorage.clear());

describe('dashboard cache versioning', () => {
  it('ignores a payload stored under the old, unversioned key', async () => {
    await AsyncStorage.setItem('dashboard-cache:owner:o1', JSON.stringify({ old: true }));
    expect(await readDashboardCache('owner', 'o1')).toBeNull();
  });

  it('reads back what it wrote', async () => {
    writeDashboardCache('owner', 'o1', { fresh: true });
    await new Promise((r) => setImmediate(r));
    expect(await readDashboardCache('owner', 'o1')).toEqual({ fresh: true });
  });

  it('sign-out clears old and current entries', async () => {
    await AsyncStorage.setItem('dashboard-cache:owner:o1', '{}');
    writeDashboardCache('owner', 'o1', {});
    await new Promise((r) => setImmediate(r));
    await clearDashboardCaches();
    expect(
      (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('dashboard-cache:'))
    ).toEqual([]);
  });
});
