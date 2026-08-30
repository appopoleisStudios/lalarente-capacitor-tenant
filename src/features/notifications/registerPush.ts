import { Platform } from 'react-native';
import notificationsApi from './api/notificationsApi';

/** Register an Expo push token. Safe no-op if the native module is not in this binary. */
export async function registerDevicePush(userId: string): Promise<void> {
  if (!userId || Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      finalStatus = asked.status;
    }
    if (finalStatus !== 'granted') return;
    const tokenRes = await Notifications.getExpoPushTokenAsync();
    const token = tokenRes?.data;
    if (!token) return;
    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    await notificationsApi.registerPushToken(userId, token, platform);
  } catch {
    // Native module missing until the next APK / dev-client rebuild.
  }
}
