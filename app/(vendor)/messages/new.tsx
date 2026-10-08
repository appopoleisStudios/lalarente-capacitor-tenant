import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';

export default function VendorComposeMessageScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>New Message</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.body}>
        <Ionicons name="construct-outline" size={64} color={colors.gray[300]} />
        <Text style={styles.heading}>Use Job Threads</Text>
        <Text style={styles.sub}>
          As a vendor, messages are sent through the job assigned to you. Open a job from My Jobs to
          chat with the owner and tenant.
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.replace('/(vendor)/jobs' as any)}
        >
          <Text style={styles.btnText}>View My Jobs</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  back: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  heading: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 12 },
  sub: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  btn: {
    backgroundColor: colors.rsa.gold,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: { fontSize: 15, fontWeight: '700', color: '#111827' },
});
