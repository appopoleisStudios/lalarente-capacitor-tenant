import { NativeModules, Platform } from 'react-native';
import notificationsApi from './api/notificationsApi';

/** Register an Expo push token. Safe no-op if the native module is not in this binary. */
export async function registerDevicePush(userId: string): Promise<void> {
  if (!userId || Platform.OS === 'web') return;
  // ExpoPushTokenManager is not linked in the dev-client build — skip entirely
  // to prevent the native bridge from surfacing an unhandled LogBox error.
  if (!NativeModules.ExpoPushTokenManager) return;
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

/**
 * Stop this device receiving the signed-out user's push notifications:
 * delete its token row. Must run while the session is still valid (RLS).
 * Never prompts for permission; safe no-op when push isn't available.
 */
export async function unregisterDevicePush(): Promise<void> {
  if (Platform.OS === 'web' || !NativeModules.ExpoPushTokenManager) return;
  try {
    const Notifications = await import('expo-notifications');
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const token = (await Notifications.getExpoPushTokenAsync())?.data;
    if (token) await notificationsApi.removePushToken(token);
  } catch {
    // best effort — sign-out must still succeed
  }
}
