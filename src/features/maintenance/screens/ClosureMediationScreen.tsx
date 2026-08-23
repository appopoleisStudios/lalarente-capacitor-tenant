import { useAuth } from '@/src/contexts/AuthContext';
import { getClosureReport } from '@/src/features/maintenance/api';
import {
  addMediationMessage,
  getMediationMessages,
} from '@/src/features/maintenance/api/work/tenantVerification.api';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PartyRole = 'owner' | 'tenant' | 'vendor';

export default function ClosureMediationScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { user, profile } = useAuth();
  const role = (
    profile?.role === 'owner' || profile?.role === 'vendor' ? profile.role : 'tenant'
  ) as PartyRole;
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [closureId, setClosureId] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    { id: string; sender_role: string; message: string; created_at: string }[]
  >([]);

  const load = useCallback(async () => {
    if (!requestId) return;
    try {
      setLoading(true);
      const report = await getClosureReport(requestId);
      if (!report?.id) {
        Alert.alert('Unavailable', 'No closure report on this job yet.');
        return;
      }
      setClosureId(report.id);
      setReason((report as { mediation_reason?: string | null }).mediation_reason || null);
      const rows = await getMediationMessages(report.id);
      setMessages(
        rows.map((row) => ({
          id: row.id,
          sender_role: row.sender_role,
          message: row.message,
          created_at: row.created_at,
        }))
      );
    } catch (err) {
      console.error('Mediation load failed:', err);
      Alert.alert('Error', 'Could not load mediation.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!user?.id || !closureId) return;
    if (draft.trim().length < 5) {
      Alert.alert('Required', 'Write at least 5 characters.');
      return;
    }
    try {
      setSending(true);
      await addMediationMessage(closureId, user.id, role, draft.trim());
      setDraft('');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not send.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title} testID="closure-mediation-title">
          Job mediation
        </Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary[600]} />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.body} testID="closure-mediation-thread">
            <Text style={styles.lede}>
              Owner, tenant, and vendor can talk here after a job is disputed three times. This is
              not a rent payment dispute.
            </Text>
            {reason ? <Text style={styles.reason}>{reason}</Text> : null}
            {messages.length === 0 ? (
              <Text style={styles.empty}>No messages yet. Explain what still is not right.</Text>
            ) : (
              messages.map((msg) => (
                <View key={msg.id} style={styles.bubble}>
                  <Text style={styles.who}>{msg.sender_role}</Text>
                  <Text style={styles.msg}>{msg.message}</Text>
                </View>
              ))
            )}
          </ScrollView>
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message the other parties"
              multiline
              testID="closure-mediation-input"
            />
            <TouchableOpacity
              style={styles.send}
              onPress={send}
              disabled={sending}
              testID="closure-mediation-send"
            >
              <Text style={styles.sendText}>{sending ? '…' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  body: { padding: 16, paddingBottom: 32 },
  lede: { fontSize: 14, color: '#4B5563', marginBottom: 12, lineHeight: 20 },
  reason: { fontSize: 13, color: '#92400E', marginBottom: 16 },
  empty: { fontSize: 14, color: '#6B7280' },
  bubble: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  who: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  msg: { fontSize: 15, color: '#111827' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  send: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sendText: { color: '#fff', fontWeight: '700' },
});
