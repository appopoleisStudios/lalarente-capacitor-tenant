import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';

/**
 * Sign-out route — call via deep link (lalarenteapp:///auth/signout) to
 * reliably clear any cached session from SecureStore regardless of role.
 * Used by Maestro E2E flows to switch between test accounts.
 */
export default function SignOutScreen() {
  const { signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    signOut()
      .then(() => {
        router.replace('/auth/login');
      })
      .catch(() => {
        // Even if sign out fails, force navigation to login screen
        router.replace('/auth/login');
      });
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#002395" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
