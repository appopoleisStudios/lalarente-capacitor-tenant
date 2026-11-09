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
import { generateLeaseHTML } from '../../leases/api/leasePdfService';
import { leaseDraftStore } from '../../leases/utils/leaseDraftStore';

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
  const [showClausesModal, setShowClausesModal] = useState(false);
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!draft) {
      router.back();
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regenerate preview whenever custom clauses change.
  useEffect(() => {
    if (app) buildHtml(app, customClauses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customClauses, app]);

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
      rent_escalation_type: d.rentEscalationValue ? d.leaseType : null,
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
    setHtml(generateLeaseHTML(leaseData, clauses || undefined));
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
          late_fee_amount: draft.lateFeeAmount ? parseFloat(draft.lateFeeAmount) : null,
          late_fee_grace_days: draft.lateFeeGraceDays ? parseInt(draft.lateFeeGraceDays) : null,
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
          status: 'pending_signatures',
          lease_custom_clauses: customClauses.trim() || null,
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
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
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
          />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={RSA.blue} />
          </View>
        )}
      </View>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.clausesBtn} onPress={() => setShowClausesModal(true)}>
          <Ionicons name="add-circle-outline" size={18} color={RSA.blue} />
          <Text style={styles.clausesBtnText}>
            {customClauses.trim() ? 'Edit Custom Clauses' : 'Add Custom Clauses'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendBtn, submitting && styles.btnDisabled]}
          onPress={handleSendToTenant}
          disabled={submitting}
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
              <Text style={styles.modalTitle}>Additional Terms</Text>
              <TouchableOpacity onPress={() => setShowClausesModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              These clauses will be appended as "Additional Terms" at the end of the lease.
            </Text>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <TextInput
                style={styles.clausesInput}
                multiline
                placeholder="e.g. Tenant is responsible for pool maintenance. No pets without written consent…"
                placeholderTextColor="#aaa"
                value={customClauses}
                onChangeText={setCustomClauses}
                autoFocus
              />
            </ScrollView>
            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowClausesModal(false)}>
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
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  modalHint: { fontSize: 13, color: '#777', marginBottom: 12 },
  modalScroll: { flexGrow: 0, maxHeight: 220 },
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
