import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import * as Sentry from '@sentry/react-native';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { env } from '@/src/core/config/env';
import '../global.css';

// Init Sentry early — before any component mounts.
// Gated: only initializes if EXPO_PUBLIC_SENTRY_DSN is set.
if (env.sentry.dsn) {
  Sentry.init({
    dsn: env.sentry.dsn,
  });
}

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const router = useRouter();

  // Redirect to login whenever session is lost (sign out, token expiry)
  useEffect(() => {
    if (!loading && !session) {
      router.replace('/auth/login');
    }
  }, [session, loading]);

  // Stack is always rendered — never conditionally unmount it, as doing so
  // destroys the navigator context and breaks any in-flight router.replace calls
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/register" />
      <Stack.Screen name="(owner)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
