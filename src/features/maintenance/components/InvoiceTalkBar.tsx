import { useAuth } from '@/src/contexts/AuthContext';
import {
  confirmInvoiceTalk,
  escalateInvoiceToLalaRente,
  getInvoiceTalkState,
  getMaintenanceRequestById,
  logTalkEvent,
  type MaintenanceInvoice,
} from '@/src/features/maintenance/api';
import { messagesApi } from '@/src/features/messaging/api/messagesApi';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '@/src/lib/supabase';

type PartyRole = 'owner' | 'tenant' | 'vendor';

type Props = {
  invoice: MaintenanceInvoice;
  role: PartyRole;
  accent: string;
  onChanged?: () => void;
};

export function InvoiceTalkBar({ invoice, role, accent, onChanged }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [talk, setTalk] = useState<{ confirmedByMe: boolean; bothConfirmed: boolean } | null>(null);
  const [otherPhone, setOtherPhone] = useState<string | null>(null);

  const canTalk = invoice.status === 'submitted' || invoice.status === 'rejected';
  const disputed = invoice.status === 'disputed';

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const request = await getMaintenanceRequestById(invoice.maintenance_request_id);
      const state = await getInvoiceTalkState(invoice, user.id, request.tenant_id);
      setTalk({ confirmedByMe: state.confirmedByMe, bothConfirmed: state.bothConfirmed });
      const otherId =
        role === 'vendor'
          ? invoice.payer_role === 'tenant'
            ? request.tenant_id
            : invoice.owner_id
          : invoice.vendor_id;
      if (otherId) {
        const { data } = await supabase.from('profiles').select('phone').eq('id', otherId).single();
        setOtherPhone((data as { phone?: string | null } | null)?.phone || null);
      }
    } catch (err) {
      console.error('Invoice talk load failed:', err);
    }
  }, [
    invoice.id,
    invoice.maintenance_request_id,
    invoice.owner_id,
    invoice.payer_role,
    invoice.vendor_id,
    role,
    user?.id,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const openChat = async () => {
    if (!user?.id) return;
    try {
      setBusy(true);
      const request = await getMaintenanceRequestById(invoice.maintenance_request_id);
      if (!request.owner_id || !request.tenant_id) {
        Alert.alert('Unavailable', 'This job is missing owner or tenant details for chat.');
        return;
      }
      const thread = await messagesApi.getOrCreateThread(
        request.owner_id,
        request.tenant_id,
        request.property_id ?? undefined,
        `Invoice ${invoice.invoice_number}`,
        'maintenance'
      );
      if (role === 'vendor') {
        await messagesApi.sendMessage({
          thread_id: thread.id,
          content: `Discussing invoice ${invoice.invoice_number} before LalaRente review.`,
          sender_id: user.id,
          sender_role: 'vendor',
        });
      }
      await logTalkEvent('opened_chat', invoice, user.id, {
        invoice_number: invoice.invoice_number,
      });
      const path =
        role === 'vendor'
          ? `/(vendor)/messages/${thread.id}`
          : role === 'tenant'
            ? `/(tenant)/messages/${thread.id}`
            : `/(owner)/messages/${thread.id}`;
      router.push(path as any);
    } catch (error: any) {
      Alert.alert('Chat', error.message || 'Could not open the maintenance thread.');
    } finally {
      setBusy(false);
    }
  };

  const tapCall = async () => {
    if (!user?.id) return;
    if (!otherPhone) {
      Alert.alert('No phone on file', 'The other party has not added a phone number.');
      return;
    }
    await logTalkEvent('tapped_call', invoice, user.id, {
      invoice_number: invoice.invoice_number,
    });
    const url = `tel:${otherPhone.replace(/\s+/g, '')}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Call', otherPhone);
      return;
    }
    await Linking.openURL(url);
  };

  const confirmTalk = async () => {
    if (!user?.id) return;
    try {
      setBusy(true);
      await confirmInvoiceTalk(invoice.id, user.id);
      await logTalkEvent('confirmed_talk', invoice, user.id, {
        invoice_number: invoice.invoice_number,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
      onChanged?.();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not save confirmation.');
    } finally {
      setBusy(false);
    }
  };

  const escalate = async () => {
    Alert.alert(
      'Ask LalaRente to decide',
      'This is a pre-pay invoice disagreement. Admin will see the case log, extras vs quote, and chat. Final in-app: uphold vendor, amend amount, or reject.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Escalate',
          onPress: async () => {
            try {
              setBusy(true);
              await escalateInvoiceToLalaRente(invoice.id);
              if (user?.id) {
                await logTalkEvent('escalated', invoice, user.id, {
                  invoice_number: invoice.invoice_number,
                });
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onChanged?.();
            } catch (error: any) {
              Alert.alert(
                'Cannot escalate',
                error.message || 'Both sides must confirm they talked.'
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  if (!canTalk && !disputed) return null;

  return (
    <View style={styles.wrap} testID="invoice-talk-bar">
      <Text style={styles.title}>Talk it out before LalaRente</Text>
      <Text style={styles.sub}>
        Chat or call first. Both sides confirm they tried. Then either can ask LalaRente to decide.
        This is not a rent or PayFast dispute.
      </Text>
      {disputed ? (
        <Text style={styles.disputed}>Escalated — waiting for a LalaRente decision.</Text>
      ) : (
        <>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, { borderColor: accent }]}
              onPress={openChat}
              disabled={busy}
              testID="invoice-chat-button"
            >
              <Ionicons name="chatbubbles-outline" size={16} color={accent} />
              <Text style={[styles.btnText, { color: accent }]}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { borderColor: accent }]}
              onPress={tapCall}
              disabled={busy}
              testID="invoice-call-button"
            >
              <Ionicons name="call-outline" size={16} color={accent} />
              <Text style={[styles.btnText, { color: accent }]}>Call</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.fullBtn, talk?.confirmedByMe && styles.fullBtnDone]}
            onPress={confirmTalk}
            disabled={busy || talk?.confirmedByMe}
            testID="invoice-confirm-talk-button"
          >
            <Text style={styles.fullBtnText}>
              {talk?.confirmedByMe ? 'You confirmed you tried to talk' : 'I tried to talk'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.escalate, !talk?.bothConfirmed && styles.escalateDisabled]}
            onPress={escalate}
            disabled={busy || !talk?.bothConfirmed}
            testID="invoice-escalate-button"
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.escalateText}>Ask LalaRente to decide</Text>
            )}
          </TouchableOpacity>
          {!talk?.bothConfirmed && (
            <Text style={styles.hint}>
              Escalate unlocks after both the vendor and the payer confirm.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  title: { fontSize: 14, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 12, color: '#6B7280', lineHeight: 16 },
  disputed: { fontSize: 13, fontWeight: '600', color: colors.warning[700] },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  btnText: { fontSize: 13, fontWeight: '700' },
  fullBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
  },
  fullBtnDone: { backgroundColor: '#ECFDF5' },
  fullBtnText: { fontSize: 13, fontWeight: '600', color: '#111827' },
  escalate: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
  },
  escalateDisabled: { opacity: 0.4 },
  escalateText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  hint: { fontSize: 11, color: '#9CA3AF' },
});
