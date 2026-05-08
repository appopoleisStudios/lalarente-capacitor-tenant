import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import '../global.css';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const router = useRouter();

  // Redirect to login whenever session is lost (sign out, token expiry)
  useEffect(() => {
    if (!loading && !session) {
      router.replace('/auth/login');
    }
  }, [session, loading, router]);

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
