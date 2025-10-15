import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';

const RSA = { blue: '#002395', red: '#DE3831' };

export default function ProfileScreen() {
  const router = useRouter();

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => router.replace('/auth/login') },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>TM</Text>
          </View>
          <Text style={styles.name}>Thabo Mokoena</Text>
          <Text style={styles.email}>thabo@example.com</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Owner Account</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          <AnimatedButton>
            <View style={styles.menuItem}>
              <Text style={styles.menuIcon}>��</Text>
              <Text style={styles.menuText}>Edit Profile</Text>
              <Text style={styles.menuArrow}>›</Text>
            </View>
          </AnimatedButton>
          <AnimatedButton>
            <View style={styles.menuItem}>
              <Text style={styles.menuIcon}>🔔</Text>
              <Text style={styles.menuText}>Notifications</Text>
              <Text style={styles.menuArrow}>›</Text>
            </View>
          </AnimatedButton>
        </View>

        <AnimatedButton onPress={handleLogout}>
          <View style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </View>
        </AnimatedButton>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  profileCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#e5e7eb' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: RSA.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#ffffff' },
  name: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  email: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  badge: { backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#1e40af' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 12, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  menuIcon: { fontSize: 20, marginRight: 12 },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  menuArrow: { fontSize: 24, color: '#9ca3af' },
  logoutButton: { backgroundColor: RSA.red, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  version: { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 24 },
});
