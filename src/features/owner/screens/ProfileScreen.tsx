import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/src/lib/supabase';
import { APP_INFO } from '@/src/shared/config/appInfo';

const RSA = { blue: '#002395', red: '#DE3831' };

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .single();

      setEmail(user.email || '');
      setFullName((profile as any)?.full_name || '');
      setPhone((profile as any)?.phone || '');
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone: phone || null })
        .eq('id', user.id);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Profile updated successfully');
      setEditing(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const initials = fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RSA.blue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => (editing ? handleSave() : setEditing(true))} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={RSA.blue} />
          ) : (
            <Text style={styles.editBtn}>{editing ? 'Save' : 'Edit'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Avatar */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor="#9ca3af"
            />
          ) : (
            <Text style={styles.name}>{fullName || 'No name set'}</Text>
          )}
          <Text style={styles.email}>{email}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Owner Account</Text>
          </View>
        </View>

        {/* Phone */}
        {editing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+27 XX XXX XXXX"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
            </View>
          </View>
        )}

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(owner)/notifications' as any)}>
            <Ionicons name="notifications-outline" size={20} color={RSA.blue} style={styles.menuIcon} />
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Legal & Compliance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal & Compliance</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(owner)/privacy' as any)}>
            <Ionicons name="shield-checkmark-outline" size={20} color={RSA.blue} style={styles.menuIcon} />
            <Text style={styles.menuText}>Privacy & POPIA</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(owner)/arrears' as any)}>
            <Ionicons name="card-outline" size={20} color={RSA.blue} style={styles.menuIcon} />
            <Text style={styles.menuText}>Arrears Management</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(owner)/renewals' as any)}>
            <Ionicons name="refresh-outline" size={20} color={RSA.blue} style={styles.menuIcon} />
            <Text style={styles.menuText}>Lease Renewals</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>{APP_INFO.versionLabel}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  editBtn: { fontSize: 16, fontWeight: '600', color: RSA.blue },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: RSA.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#ffffff' },
  name: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  nameInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    borderBottomWidth: 1,
    borderColor: RSA.blue,
    paddingBottom: 4,
    marginBottom: 4,
    width: '80%',
    textAlign: 'center',
  },
  email: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  badge: { backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#1e40af' },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111827',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  menuIcon: { marginRight: 12 },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: RSA.red,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  version: { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 24 },
});
