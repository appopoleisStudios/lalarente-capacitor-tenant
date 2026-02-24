/**
 * ComposeMessageScreen
 * Initiates a new conversation:
 * - Tenant → Owner: auto-selects owner from active lease
 * - Owner → Tenant: shows picker if multiple active leases; auto-selects if one
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';
import { supabase } from '@/src/lib/supabase';
import { messagesApi } from '../api/messagesApi';
import type { ThreadCategory } from '../types';

interface LeaseSummary {
  id: string;
  owner_id: string;
  tenant_id: string;
  property_id: string;
  owner: { id: string; full_name: string } | null;
  tenant: { id: string; full_name: string } | null;
  property: { id: string; title: string } | null;
}

interface Props {
  role?: 'owner' | 'tenant';
}

const CATEGORIES: { value: ThreadCategory; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: 'chatbubble-outline' },
  { value: 'maintenance', label: 'Maintenance', icon: 'construct-outline' },
  { value: 'lease', label: 'Lease', icon: 'document-text-outline' },
  { value: 'payment', label: 'Payment', icon: 'card-outline' },
  { value: 'emergency', label: 'Emergency', icon: 'warning-outline' },
];

export default function ComposeMessageScreen({ role = 'tenant' }: Props) {
  const router = useRouter();
  const primaryColor = role === 'tenant' ? colors.rsa.green : colors.rsa.blue;

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Lease data
  const [leases, setLeases] = useState<LeaseSummary[]>([]);
  const [selectedLease, setSelectedLease] = useState<LeaseSummary | null>(null);
  const [showLeasePicker, setShowLeasePicker] = useState(false);

  // Form
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<ThreadCategory>('general');
  const [message, setMessage] = useState('');

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      if (role === 'tenant') {
        // Tenant: find active lease to get owner
        const { data: activeLease } = await supabase
          .from('leases')
          .select(`
            id, owner_id, tenant_id, property_id,
            owner:profiles!owner_id(id, full_name),
            tenant:profiles!tenant_id(id, full_name),
            property:properties!property_id(id, title)
          `)
          .eq('tenant_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeLease) {
          const lease = activeLease as unknown as LeaseSummary;
          setLeases([lease]);
          setSelectedLease(lease);
        }
      } else {
        // Owner: find all active leases to pick a tenant
        const { data: activeLeases } = await supabase
          .from('leases')
          .select(`
            id, owner_id, tenant_id, property_id,
            owner:profiles!owner_id(id, full_name),
            tenant:profiles!tenant_id(id, full_name),
            property:properties!property_id(id, title)
          `)
          .eq('owner_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        const leaseList = (activeLeases ?? []) as unknown as LeaseSummary[];
        setLeases(leaseList);

        if (leaseList.length === 1) {
          setSelectedLease(leaseList[0]);
        } else if (leaseList.length > 1) {
          setShowLeasePicker(true);
        }
      }
    } catch (err) {
      console.error('Error initialising compose screen:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim()) {
      Alert.alert('Subject Required', 'Please add a subject for your message.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Message Required', 'Please write a message before sending.');
      return;
    }
    if (!selectedLease || !userId) {
      Alert.alert('No Recipient', 'Please select a tenant/landlord to message.');
      return;
    }

    setSending(true);
    try {
      const thread = await messagesApi.createThread({
        owner_id: selectedLease.owner_id,
        tenant_id: selectedLease.tenant_id,
        property_id: selectedLease.property_id,
        lease_id: selectedLease.id,
        subject: subject.trim(),
        category,
        initial_message: message.trim(),
        sender_role: role,
      });

      const dest = role === 'tenant'
        ? `/(tenant)/messages/${thread.id}`
        : `/(owner)/messages/${thread.id}`;
      router.replace(dest as any);
    } catch (err: any) {
      console.error('Error sending message:', err);
      Alert.alert('Send Failed', err.message || 'Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const otherPartyName = selectedLease
    ? role === 'tenant'
      ? selectedLease.owner?.full_name
      : selectedLease.tenant?.full_name
    : null;

  const canSend = subject.trim().length > 0 && message.trim().length > 0 && !sending && !!selectedLease;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Message</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      </SafeAreaView>
    );
  }

  // ── No active lease ──────────────────────────────────────────────────────────
  if (leases.length === 0) {
    const emptyTitle = role === 'tenant' ? 'No Active Lease' : 'No Active Tenants';
    const emptyText = role === 'tenant'
      ? 'You need an active lease to message your landlord. Search for properties and apply to get started.'
      : 'You have no active tenants. Once a tenant signs a lease, you can message them here.';

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Message</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="home-outline" size={64} color={colors.gray[300]} />
          <Text style={styles.noLeaseTitle}>{emptyTitle}</Text>
          <Text style={styles.noLeaseText}>{emptyText}</Text>
          {role === 'tenant' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: primaryColor }]}
              onPress={() => router.replace('/(tenant)/search' as any)}
            >
              <Text style={styles.actionBtnText}>Find Properties</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Lease picker (owner with multiple tenants) ───────────────────────────────
  if (showLeasePicker) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Tenant</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={styles.pickerList}>
          <Text style={styles.pickerHint}>Choose a tenant to message:</Text>
          {leases.map(lease => (
            <TouchableOpacity
              key={lease.id}
              style={styles.pickerRow}
              onPress={() => {
                setSelectedLease(lease);
                setShowLeasePicker(false);
              }}
            >
              <View style={[styles.pickerAvatar, { backgroundColor: primaryColor }]}>
                <Text style={styles.pickerAvatarText}>
                  {lease.tenant?.full_name?.charAt(0).toUpperCase() ?? '?'}
                </Text>
              </View>
              <View style={styles.pickerInfo}>
                <Text style={styles.pickerName}>{lease.tenant?.full_name ?? 'Unknown'}</Text>
                {lease.property && (
                  <Text style={styles.pickerProp}>{lease.property.title}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Compose form ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Message</Text>
        <TouchableOpacity
          style={[styles.sendHeaderBtn, { backgroundColor: primaryColor }, !canSend && styles.sendHeaderBtnDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <Text style={styles.sendHeaderBtnText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* To */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>To</Text>
            <TouchableOpacity
              style={styles.recipientChip}
              onPress={() => leases.length > 1 && setShowLeasePicker(true)}
              disabled={leases.length <= 1}
            >
              <Ionicons name="person-circle" size={18} color={primaryColor} />
              <Text style={styles.recipientName}>{otherPartyName ?? 'Unknown'}</Text>
              {selectedLease?.property && (
                <Text style={styles.recipientProp}> · {selectedLease.property.title}</Text>
              )}
              {leases.length > 1 && (
                <Ionicons name="chevron-down" size={14} color={colors.text.secondary} style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Subject */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Subject</Text>
            <TextInput
              style={styles.subjectInput}
              value={subject}
              onChangeText={setSubject}
              placeholder="E.g., Question about lease renewal"
              placeholderTextColor={colors.text.tertiary}
              maxLength={120}
              returnKeyType="next"
            />
          </View>

          <View style={styles.divider} />

          {/* Category */}
          <View style={styles.categorySection}>
            <Text style={styles.categoryLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              <View style={styles.categoryRow}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryChip,
                      category === cat.value && { backgroundColor: primaryColor },
                    ]}
                    onPress={() => setCategory(cat.value)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={14}
                      color={category === cat.value ? colors.text.inverse : colors.text.secondary}
                    />
                    <Text style={[
                      styles.categoryChipText,
                      category === cat.value && { color: colors.text.inverse },
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.divider} />

          {/* Message */}
          <View style={styles.messageSection}>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Write your message here..."
              placeholderTextColor={colors.text.tertiary}
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={styles.charCount}>{message.length}/2000</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.default },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  sendHeaderBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendHeaderBtnDisabled: { opacity: 0.4 },
  sendHeaderBtnText: { fontSize: 14, fontWeight: '600', color: colors.text.inverse },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  noLeaseTitle: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginTop: 16 },
  noLeaseText: {
    fontSize: 14, color: colors.text.secondary, textAlign: 'center',
    marginTop: 8, marginBottom: 24, lineHeight: 20,
  },
  actionBtn: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
  },
  actionBtnText: { color: colors.text.inverse, fontSize: 14, fontWeight: '600' },
  // Picker
  pickerList: { flex: 1 },
  pickerHint: {
    fontSize: 14, color: colors.text.secondary,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1, borderBottomColor: colors.border.default,
    gap: 12,
  },
  pickerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  pickerAvatarText: { fontSize: 18, fontWeight: '600', color: colors.text.inverse },
  pickerInfo: { flex: 1 },
  pickerName: { fontSize: 16, fontWeight: '600', color: colors.text.primary },
  pickerProp: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  // Form
  content: { flex: 1 },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  fieldLabel: {
    fontSize: 14, fontWeight: '600', color: colors.text.secondary, width: 60,
  },
  recipientChip: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  recipientName: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  recipientProp: { fontSize: 13, color: colors.text.secondary },
  subjectInput: {
    flex: 1, fontSize: 15, color: colors.text.primary, padding: 0,
  },
  divider: { height: 1, backgroundColor: colors.border.default, marginHorizontal: 16 },
  categorySection: { paddingTop: 14, paddingBottom: 10 },
  categoryLabel: {
    fontSize: 14, fontWeight: '600', color: colors.text.secondary,
    paddingHorizontal: 16, marginBottom: 10,
  },
  categoryScroll: { paddingLeft: 16 },
  categoryRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  categoryChipText: { fontSize: 13, fontWeight: '500', color: colors.text.secondary },
  messageSection: { padding: 16, minHeight: 200 },
  messageInput: {
    fontSize: 15, color: colors.text.primary, minHeight: 200,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 12, color: colors.text.tertiary, textAlign: 'right', marginTop: 8,
  },
});
