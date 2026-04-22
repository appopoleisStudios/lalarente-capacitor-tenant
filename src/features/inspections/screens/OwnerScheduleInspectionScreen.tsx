import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { inspectionsApi } from '../api/inspectionsApi';
import { supabase } from '../../../lib/supabase';
import type { InspectionType } from '../types';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';

const RSA = { blue: '#002395', gold: '#FFB81C' };

const TYPES: { value: InspectionType; label: string; desc: string; icon: string }[] = [
  { value: 'move_in', label: 'Move-In', desc: 'Before tenant takes occupation', icon: '🏠' },
  { value: 'periodic', label: 'Periodic', desc: 'Routine mid-tenancy check', icon: '📋' },
  { value: 'move_out', label: 'Move-Out', desc: 'End of tenancy condition report', icon: '📦' },
];

interface ActiveLease {
  id: string;
  property_title: string;
  tenant_name: string;
  status: string | null;
  start_date: string;
  has_move_in_inspection?: boolean;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function OwnerScheduleInspectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const prefilledLeaseId = params.leaseId as string | undefined;
  const prefilledType = params.type as InspectionType | undefined;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [leases, setLeases] = useState<ActiveLease[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>(prefilledLeaseId || '');
  const [selectedType, setSelectedType] = useState<InspectionType>(prefilledType || 'move_in');
  const [scheduledDate, setScheduledDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000)); // Tomorrow
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setOwnerId(user.id);

      // Fetch active leases with property + tenant
      const { data: leasesData, error } = await supabase
        .from('leases')
        .select(`
          id, status, start_date,
          properties!property_id(title),
          profiles!tenant_id(full_name)
        `)
        .eq('owner_id', user.id)
        .in('status', ['active', 'pending_tenant_signature', 'pending_owner_signature'])
        .order('start_date', { ascending: false });

      if (error) throw error;

      const formattedLeases: ActiveLease[] = (leasesData || []).map((l: any) => ({
        id: l.id,
        property_title: l.properties?.title || 'Property',
        tenant_name: l.profiles?.full_name || 'Tenant',
        status: l.status,
        start_date: l.start_date,
      }));

      setLeases(formattedLeases);

      // Smart default: if a leaseId is pre-filled, auto-select it
      if (prefilledLeaseId && formattedLeases.find(l => l.id === prefilledLeaseId)) {
        setSelectedLeaseId(prefilledLeaseId);
      } else if (formattedLeases.length === 1) {
        setSelectedLeaseId(formattedLeases[0].id);
      }
    } catch (err) {
      console.error('Error loading leases:', err);
      Alert.alert('Error', 'Failed to load active leases');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setScheduledDate(date);
  };

  const handleSubmit = async () => {
    if (!selectedLeaseId) {
      Alert.alert('Required', 'Please select a lease.');
      return;
    }

    try {
      setSubmitting(true);
      const dateStr = scheduledDate.toISOString();

      let inspection;
      if (selectedType === 'move_in') {
        inspection = await inspectionsApi.scheduleMoveInInspection(selectedLeaseId, dateStr);
      } else if (selectedType === 'move_out') {
        inspection = await inspectionsApi.scheduleMoveOutInspection(selectedLeaseId, dateStr);
      } else {
        // Periodic — need to create with full details
        const { data: lease } = await supabase
          .from('leases')
          .select('property_id, tenant_id, owner_id')
          .eq('id', selectedLeaseId)
          .single();

        if (!lease) throw new Error('Lease not found');
        inspection = await inspectionsApi.createInspection({
          property_id: lease.property_id!,
          lease_id: selectedLeaseId,
          tenant_id: lease.tenant_id!,
          owner_id: lease.owner_id!,
          type: 'periodic',
          scheduled_date: dateStr,
        });
      }

      Alert.alert('Inspection Scheduled', 'The inspection has been scheduled successfully. The tenant will be notified.', [
        {
          text: 'Open Inspection',
          onPress: () => {
            router.back();
            router.push({
              pathname: '/(owner)/inspections/[id]' as any,
              params: { id: inspection.id },
            });
          },
        },
        {
          text: 'Done',
          onPress: () => router.back(),
        },
      ]);
    } catch (err) {
      console.error('Error scheduling inspection:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to schedule inspection');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RSA.blue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule Inspection</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Inspection Type */}
        <Text style={styles.sectionLabel}>Inspection Type</Text>
        <View style={styles.typeGrid}>
          {TYPES.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.typeCard, selectedType === t.value && styles.typeCardActive]}
              onPress={() => setSelectedType(t.value)}
            >
              <Text style={styles.typeIcon}>{t.icon}</Text>
              <Text style={[styles.typeLabel, selectedType === t.value && styles.typeLabelActive]}>
                {t.label}
              </Text>
              <Text style={styles.typeDesc}>{t.desc}</Text>
              {selectedType === t.value && (
                <View style={styles.checkMark}>
                  <Ionicons name="checkmark-circle" size={18} color={RSA.blue} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Lease Selector */}
        <Text style={styles.sectionLabel}>Select Lease</Text>
        {leases.length === 0 ? (
          <View style={styles.noLeases}>
            <Ionicons name="document-outline" size={32} color="#D1D5DB" />
            <Text style={styles.noLeasesText}>No active leases found. Create a lease first.</Text>
          </View>
        ) : (
          <View style={styles.leaseList}>
            {leases.map(lease => (
              <TouchableOpacity
                key={lease.id}
                style={[styles.leaseCard, selectedLeaseId === lease.id && styles.leaseCardActive]}
                onPress={() => setSelectedLeaseId(lease.id)}
              >
                <View style={styles.leaseRadio}>
                  <View style={[styles.radioOuter, selectedLeaseId === lease.id && styles.radioOuterActive]}>
                    {selectedLeaseId === lease.id && <View style={styles.radioInner} />}
                  </View>
                </View>
                <View style={styles.leaseInfo}>
                  <Text style={styles.leaseProperty}>{lease.property_title}</Text>
                  <Text style={styles.leaseTenant}>Tenant: {lease.tenant_name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Date Picker */}
        <Text style={styles.sectionLabel}>Inspection Date</Text>
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color={RSA.blue} />
          <Text style={styles.dateText}>{formatDate(scheduledDate)}</Text>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={scheduledDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={handleDateChange}
          />
        )}
        {Platform.OS === 'ios' && showDatePicker && (
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => setShowDatePicker(false)}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        )}

        {/* Notes */}
        <Text style={styles.sectionLabel}>Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Any special instructions or items to focus on..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Legal Note */}
        <View style={styles.legalNote}>
          <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
          <Text style={styles.legalNoteText}>
            RHA s5(3)(e)–(f): A joint inspection must be conducted before tenant takes occupation. Minimum 24 hours written notice required.
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (!selectedLeaseId || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!selectedLeaseId || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="calendar-outline" size={20} color="#FFF" />
              <Text style={styles.submitBtnText}>Schedule Inspection</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 8 },
  typeGrid: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  typeCardActive: { borderColor: RSA.blue, backgroundColor: '#EFF2FF' },
  typeIcon: { fontSize: 24, marginBottom: 6 },
  typeLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 4 },
  typeLabelActive: { color: RSA.blue },
  typeDesc: { fontSize: 10, color: '#9CA3AF', textAlign: 'center' },
  checkMark: { position: 'absolute', top: 6, right: 6 },
  noLeases: { alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderRadius: 12 },
  noLeasesText: { color: '#6B7280', marginTop: 8, textAlign: 'center', fontSize: 14 },
  leaseList: { gap: 8 },
  leaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  leaseCardActive: { borderColor: RSA.blue, backgroundColor: '#EFF2FF' },
  leaseRadio: { padding: 2 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: RSA.blue },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: RSA.blue },
  leaseInfo: { flex: 1 },
  leaseProperty: { fontSize: 15, fontWeight: '700', color: '#111827' },
  leaseTenant: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateText: { flex: 1, fontSize: 15, color: '#111827' },
  doneBtn: { alignItems: 'center', paddingVertical: 10 },
  doneBtnText: { fontSize: 16, fontWeight: '600', color: RSA.blue },
  notesInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 100,
  },
  legalNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  legalNoteText: { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 18 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: RSA.blue,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  submitBtnDisabled: { backgroundColor: '#9CA3AF' },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
