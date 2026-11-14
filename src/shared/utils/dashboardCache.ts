import AsyncStorage from '@react-native-async-storage/async-storage';

// Last dashboard payload per user, so a cold start paints the dashboard
// immediately while fresh data loads. Cleared on sign-out.
const PREFIX = 'dashboard-cache:';

const keyFor = (role: string, userId: string) => `${PREFIX}${role}:${userId}`;

export async function readDashboardCache<T>(role: string, userId: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(role, userId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeDashboardCache(role: string, userId: string, data: unknown): void {
  AsyncStorage.setItem(keyFor(role, userId), JSON.stringify(data)).catch(() => {});
}

export async function clearDashboardCaches(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // best effort
  }
}
