import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import {
  generateLeaseHTML,
  getStandardClauses,
  type ClauseOverrides,
} from '../../leases/api/leasePdfService';
import { leaseDraftStore } from '../../leases/utils/leaseDraftStore';
import { colors } from '@/src/shared/theme/colors';

const RSA = { blue: '#002395', gold: '#FFB81C' };

interface FullApplication {
  id: string;
  property_id: string;
  tenant_id: string;
  property: {
    title: string;
    address: string;
    city: string;
    province: string | null;
    postal_code: string | null;
  };
  tenant: {
    full_name: string;
    email: string | null;
    phone: string | null;
    id_number: string | null;
    date_of_birth: string | null;
  };
}

export default function OwnerLeaseReviewScreen() {
  const router = useRouter();
  const draft = leaseDraftStore.get();

  const [app, setApp] = useState<FullApplication | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customClauses, setCustomClauses] = useState(draft?.customClauses ?? '');
  const [clauseOverrides, setClauseOverrides] = useState<ClauseOverrides>(
    draft?.clauseOverrides ?? {}
  );
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [showClausesModal, setShowClausesModal] = useState(false);
  const standardClauses = draft ? getStandardClauses({ lease_type: draft.leaseType }) : [];

  // Update one clause's override; an empty override is dropped so only real
  // differences from the template are stored.
  const setOverride = (id: string, next: { removed?: boolean; body?: string } | null) => {
    setClauseOverrides((prev) => {
      const updated = { ...prev };
      if (next && (next.removed || next.body)) updated[id] = next;
      else delete updated[id];
      return updated;
    });
  };
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!draft) {
      router.back();
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regenerate preview whenever the clauses change.
  useEffect(() => {
    if (app) buildHtml(app, customClauses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customClauses, clauseOverrides, app]);

  const loadData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [appResult, profileResult] = await Promise.all([
        supabase
          .from('rental_applications')
          .select(
            `
            id, property_id, tenant_id,
            property:properties!property_id(title, address, city, province, postal_code),
            tenant:profiles!tenant_id(full_name, email, phone, id_number, date_of_birth)
          `
          )
          .eq('id', draft!.applicationId)
          .eq('owner_id', user.id)
          .single(),
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      ]);

      if (appResult.error) throw appResult.error;
      setApp(appResult.data as unknown as FullApplication);
      setOwnerName(profileResult.data?.full_name ?? 'Owner');
      buildHtml(appResult.data as unknown as FullApplication, customClauses);
    } catch (err) {
      console.error('LeaseReview load error:', err);
      Alert.alert('Error', 'Failed to load lease preview.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const buildHtml = (application: FullApplication, clauses: string) => {
    const d = draft!;
    const leaseData = {
      id: d.draftLeaseId,
      property: {
        title: application.property.title,
        address: application.property.address,
        city: application.property.city,
        province: application.property.province ?? undefined,
        postal_code: application.property.postal_code ?? undefined,
      },
      owner: { full_name: ownerName || 'Owner' },
      tenant: {
        full_name: application.tenant.full_name,
        email: application.tenant.email ?? undefined,
        phone: application.tenant.phone ?? undefined,
        id_number: application.tenant.id_number ?? undefined,
        date_of_birth: application.tenant.date_of_birth ?? undefined,
      },
      start_date: d.startDate,
      end_date: d.endDate,
      monthly_rent: parseFloat(d.monthlyRent),
      deposit_amount: d.depositAmount ? parseFloat(d.depositAmount) : null,
      payment_due_day: parseInt(d.paymentDueDay),
      lease_type: d.leaseType,
      late_fee_amount: d.lateFeeAmount ? parseFloat(d.lateFeeAmount) : null,
      late_fee_grace_days: d.lateFeeGraceDays ? parseInt(d.lateFeeGraceDays) : null,
      rent_escalation_type: d.rentEscalationValue ? d.rentEscalationType : null,
      rent_escalation_value: d.rentEscalationValue ? parseFloat(d.rentEscalationValue) : null,
      rent_escalation_frequency_months: d.rentEscalationValue
        ? parseInt(d.rentEscalationFrequency)
        : null,
      owner_signature_url: null,
      tenant_signature_url: null,
      owner_signed_at: null,
      tenant_signed_at: null,
      executed_at: null,
    };
    setHtml(generateLeaseHTML(leaseData, clauses || undefined, clauseOverrides));
  };

  const handleSendToTenant = async () => {
    if (!app || !draft) return;
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: lease, error: leaseError } = await (supabase as any)
        .from('leases')
        .insert({
          id: draft.draftLeaseId,
          application_id: app.id,
          property_id: app.property_id,
          owner_id: user.id,
          tenant_id: app.tenant_id,
          start_date: draft.startDate,
          end_date: draft.endDate,
          lease_type: draft.leaseType,
          monthly_rent: parseFloat(draft.monthlyRent),
          deposit_amount: draft.depositAmount ? parseFloat(draft.depositAmount) : null,
          payment_due_day: parseInt(draft.paymentDueDay),
          // No late fees: the leases table dropped late_fee_* in favour of
          // legal interest on arrears (interest_on_arrears_rate).
          rent_escalation_type: draft.rentEscalationValue
            ? draft.rentEscalationType === 'percentage'
              ? 'fixed_percentage'
              : draft.rentEscalationType
            : null,
          rent_escalation_value: draft.rentEscalationValue
            ? parseFloat(draft.rentEscalationValue)
            : null,
          rent_escalation_frequency_months: draft.rentEscalationValue
            ? parseInt(draft.rentEscalationFrequency)
            : null,
          deposit_interest_rate: 5.25,
          status: 'pending_tenant_signature',
          lease_custom_clauses: customClauses.trim() || null,
          lease_clause_overrides: Object.keys(clauseOverrides).length ? clauseOverrides : null,
        })
        .select()
        .single();

      if (leaseError) throw leaseError;

      await supabase
        .from('rental_applications')
        .update({ status: 'lease_offered' })
        .eq('id', app.id);

      leaseDraftStore.clear();

      Alert.alert('Lease Sent', 'The tenant will be notified to sign the agreement.', [
        { text: 'OK', onPress: () => router.push(`/(owner)/leases/${lease.id}`) },
      ]);
    } catch (err) {
      console.error('Error creating lease:', err);
      Alert.alert('Error', 'Failed to create lease. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) return null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RSA.blue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="owner-lease-review-back"
          onPress={() => router.back()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Lease</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* PDF Preview */}
      <View style={styles.previewContainer}>
        {html ? (
          <WebView
            source={{ html }}
            style={styles.webview}
            scrollEnabled
            showsVerticalScrollIndicator
            javaScriptEnabled={false}
            originWhitelist={['about:blank']}
          />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={RSA.blue} />
          </View>
        )}
      </View>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          testID="owner-lease-review-clauses-open"
          style={styles.clausesBtn}
          onPress={() => setShowClausesModal(true)}
        >
          <Ionicons name="create-outline" size={18} color={RSA.blue} />
          <Text style={styles.clausesBtnText}>Edit Clauses</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="owner-lease-review-send"
          style={[styles.sendBtn, submitting && styles.btnDisabled]}
          onPress={handleSendToTenant}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Send lease to tenant"
          accessibilityState={{ disabled: submitting }}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={styles.sendBtnText}>Send to Tenant</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Custom Clauses Modal */}
      <Modal
        visible={showClausesModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowClausesModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lease Clauses</Text>
              <TouchableOpacity
                testID="owner-lease-review-clauses-close"
                onPress={() => setShowClausesModal(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Text style={styles.modalSection}>Standard clauses</Text>
              <Text style={styles.modalHint}>
                Edit or remove the standard wording. Clauses required by law or set from the lease
                details are locked.
              </Text>
              {standardClauses.map((c) => {
                const o = clauseOverrides[c.id];
                const removed = !!o?.removed;
                const edited = !!o?.body;
                const isEditing = editing?.id === c.id;
                return (
                  <View
                    key={c.id}
                    testID={`lease-clause-${c.id}`}
                    style={[styles.clauseCard, removed && styles.clauseCardRemoved]}
                  >
                    <View style={styles.clauseHeader}>
                      <Text style={[styles.clauseTitle, removed && styles.clauseRemovedText]}>
                        {c.title}
                      </Text>
                      {c.locked ? (
                        <Ionicons name="lock-closed" size={14} color={colors.text.tertiary} />
                      ) : removed ? (
                        <Text style={styles.clauseTagRemoved}>Removed</Text>
                      ) : edited ? (
                        <Text style={styles.clauseTagEdited}>Edited</Text>
                      ) : null}
                    </View>
                    {isEditing ? (
                      <>
                        <TextInput
                          testID="lease-clause-edit-input"
                          style={styles.clauseEditInput}
                          multiline
                          value={editing.text}
                          onChangeText={(text) => setEditing({ id: c.id, text })}
                          autoFocus
                        />
                        <View style={styles.clauseActions}>
                          <TouchableOpacity
                            testID="lease-clause-edit-cancel"
                            onPress={() => setEditing(null)}
                          >
                            <Text style={styles.clauseAction}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            testID="lease-clause-edit-save"
                            onPress={() => {
                              const text = editing.text.trim();
                              setOverride(c.id, text && text !== c.body ? { body: text } : null);
                              setEditing(null);
                            }}
                          >
                            <Text style={[styles.clauseAction, styles.clauseActionPrimary]}>
                              Save
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text
                          style={[styles.clauseBody, removed && styles.clauseRemovedText]}
                          numberOfLines={3}
                        >
                          {o?.body ?? c.body}
                        </Text>
                        {c.locked ? (
                          <Text style={styles.clauseLockReason}>{c.lockReason}</Text>
                        ) : (
                          <View style={styles.clauseActions}>
                            {removed ? (
                              <TouchableOpacity
                                testID={`lease-clause-${c.id}-restore`}
                                onPress={() => setOverride(c.id, null)}
                              >
                                <Text style={styles.clauseAction}>Restore</Text>
                              </TouchableOpacity>
                            ) : (
                              <>
                                {edited && (
                                  <TouchableOpacity
                                    testID={`lease-clause-${c.id}-reset`}
                                    onPress={() => setOverride(c.id, null)}
                                  >
                                    <Text style={styles.clauseAction}>Reset</Text>
                                  </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                  testID={`lease-clause-${c.id}-edit`}
                                  onPress={() => setEditing({ id: c.id, text: o?.body ?? c.body })}
                                >
                                  <Text style={styles.clauseAction}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  testID={`lease-clause-${c.id}-remove`}
                                  onPress={() => setOverride(c.id, { removed: true })}
                                >
                                  <Text style={[styles.clauseAction, styles.clauseActionDanger]}>
                                    Remove
                                  </Text>
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        )}
                      </>
                    )}
                  </View>
                );
              })}

              <Text style={styles.modalSection}>Additional terms</Text>
              <Text style={styles.modalHint}>
                Appended as "Additional Terms" at the end of the lease.
              </Text>
              <TextInput
                testID="owner-lease-review-clauses-input"
                style={styles.clausesInput}
                multiline
                placeholder="e.g. Tenant is responsible for pool maintenance."
                placeholderTextColor="#aaa"
                value={customClauses}
                onChangeText={setCustomClauses}
              />
            </ScrollView>
            <TouchableOpacity
              testID="owner-lease-review-clauses-save"
              style={styles.doneBtn}
              onPress={() => {
                const d = leaseDraftStore.get();
                if (d) leaseDraftStore.set({ ...d, customClauses, clauseOverrides });
                setEditing(null);
                setShowClausesModal(false);
              }}
            >
              <Text style={styles.doneBtnText}>Done — Update Preview</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerBtn: { padding: 4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#333' },
  previewContainer: { flex: 1 },
  webview: { flex: 1 },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  clausesBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: RSA.blue,
  },
  clausesBtnText: { color: RSA.blue, fontWeight: '600', fontSize: 14 },
  sendBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: RSA.blue,
  },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  modalHint: { fontSize: 13, color: '#777', marginBottom: 12 },
  modalScroll: { flexGrow: 0 },
  modalSection: { fontSize: 15, fontWeight: '700', color: colors.text.primary, marginTop: 8, marginBottom: 4 },
  clauseCard: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  clauseCardRemoved: { backgroundColor: colors.background.secondary, borderStyle: 'dashed' },
  clauseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  clauseTitle: { fontSize: 13, fontWeight: '700', color: colors.text.primary, flex: 1 },
  clauseBody: { fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
  clauseRemovedText: { color: colors.text.tertiary, textDecorationLine: 'line-through' },
  clauseTagEdited: { fontSize: 11, fontWeight: '700', color: RSA.blue },
  clauseTagRemoved: { fontSize: 11, fontWeight: '700', color: colors.rsa.red },
  clauseLockReason: { fontSize: 11, color: colors.text.tertiary, marginTop: 6, fontStyle: 'italic' },
  clauseActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18, marginTop: 8 },
  clauseAction: { fontSize: 14, fontWeight: '600', color: RSA.blue },
  clauseActionPrimary: { fontWeight: '700' },
  clauseActionDanger: { color: colors.rsa.red },
  clauseEditInput: {
    borderWidth: 1,
    borderColor: RSA.blue,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: colors.text.primary,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  clausesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 140,
    textAlignVertical: 'top',
  },
  doneBtn: {
    marginTop: 16,
    backgroundColor: RSA.blue,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
