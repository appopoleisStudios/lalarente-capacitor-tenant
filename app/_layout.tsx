import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { env, RELEASE_VERSION } from '@/src/core/config/env';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { QueryProvider } from '@/src/core/query/QueryProvider';
import { disableDevToolsInterference } from '@/src/core/dev/disableDevToolsInterference';
import '../global.css';

// Prevent shake / LogBox / Expo tools FAB from opening React Native DevTools during E2E.
disableDevToolsInterference();

// Init Sentry early — before any component mounts.
// Gated: only initializes if EXPO_PUBLIC_SENTRY_DSN is set.
// Wrapped in try-catch to handle malformed DSN or network errors gracefully.
if (env.sentry.dsn) {
  try {
    Sentry.init({
      dsn: env.sentry.dsn,
      tracesSampleRate: 0.2,
      release: RELEASE_VERSION,
    });
  } catch (e) {
    console.error('Sentry init failed:', e);
  }
}

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const onAuthScreen = segments[0] === 'auth';

  // Redirect to login whenever session is lost (sign out, token expiry).
  // Not when already on an auth screen: a failed sign-in flips `loading`,
  // and replacing the login screen with a fresh copy wiped the typed email
  // and the error message (CT7-028).
  useEffect(() => {
    if (!loading && !session && !onAuthScreen) {
      router.replace('/auth/login');
    }
  }, [session, loading, onAuthScreen]);

  // Stack is always rendered — never conditionally unmount it, as doing so
  // destroys the navigator context and breaks any in-flight router.replace calls
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/register" />
      <Stack.Screen name="auth/signout" />
      <Stack.Screen name="(owner)" />
      <Stack.Screen name="(tenant)" />
      <Stack.Screen name="(vendor)" />
    </Stack>
  );
}

function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          {/* Dark status-bar icons over the app's light screens. Android draws
              edge-to-edge with a transparent status bar, and the default light
              icons were invisible (clock, battery, signal) — CT7-049. */}
          <StatusBar style="dark" />
          <RootLayoutNav />
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default env.sentry.dsn ? Sentry.wrap(RootLayout) : RootLayout;
