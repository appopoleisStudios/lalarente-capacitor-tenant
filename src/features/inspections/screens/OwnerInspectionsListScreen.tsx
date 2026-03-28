import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { inspectionsApi } from '../api/inspectionsApi';
import { supabase } from '../../../lib/supabase';
import type { InspectionWithRelations, InspectionStatus } from '../types';

const RSA = { blue: '#002395', gold: '#FFB81C' };

const FILTERS: { label: string; value: InspectionStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Pending Sig', value: 'pending_signatures' },
  { label: 'Completed', value: 'completed' },
];

const TYPE_LABELS: Record<string, string> = {
  move_in: 'Move-In',
  periodic: 'Periodic',
  move_out: 'Move-Out',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3B82F6',
  in_progress: '#F59E0B',
  pending_signatures: '#8B5CF6',
  completed: '#10B981',
  cancelled: '#6B7280',
};

const TYPE_COLORS: Record<string, string> = {
  move_in: '#10B981',
  periodic: '#3B82F6',
  move_out: '#F59E0B',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OwnerInspectionsListScreen() {
  const router = useRouter();
  const [inspections, setInspections] = useState<InspectionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InspectionStatus | 'all'>('all');
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [filter])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setOwnerId(user.id);

      const status = filter === 'all' ? undefined : filter;
      const data = await inspectionsApi.getOwnerInspections(user.id, status);
      setInspections(data);
    } catch (err) {
      console.error('Error loading inspections:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = inspections; // Already filtered by API

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspections</Text>
        <TouchableOpacity
          style={styles.scheduleBtn}
          onPress={() => router.push('/(owner)/inspections/new' as any)}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.chip, filter === f.value && styles.chipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.chipText, filter === f.value && styles.chipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RSA.blue} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No Inspections Found</Text>
          <Text style={styles.emptyText}>
            Schedule a move-in inspection after a lease is signed.
          </Text>
          <TouchableOpacity
            style={styles.scheduleEmptyBtn}
            onPress={() => router.push('/(owner)/inspections/new' as any)}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FFF" />
            <Text style={styles.scheduleEmptyBtnText}>Schedule Inspection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {filtered.map(inspection => (
            <TouchableOpacity
              key={inspection.id}
              style={styles.card}
              onPress={() => router.push(`/(owner)/inspections/${inspection.id}` as any)}
              activeOpacity={0.7}
            >
              {/* Type + Status row */}
              <View style={styles.cardTop}>
                <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[inspection.type] + '20', borderColor: TYPE_COLORS[inspection.type] }]}>
                  <Text style={[styles.typeBadgeText, { color: TYPE_COLORS[inspection.type] }]}>
                    {TYPE_LABELS[inspection.type] || inspection.type}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[inspection.status || 'scheduled'] + '20' }]}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[inspection.status || 'scheduled'] }]} />
                  <Text style={[styles.statusText, { color: STATUS_COLORS[inspection.status || 'scheduled'] }]}>
                    {(inspection.status || 'scheduled').replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>

              {/* Property */}
              <Text style={styles.propertyName} numberOfLines={1}>
                {inspection.property?.title || 'Property'}
              </Text>
              <Text style={styles.propertyAddress} numberOfLines={1}>
                {inspection.property?.address || ''}{inspection.property?.city ? `, ${inspection.property.city}` : ''}
              </Text>

              {/* Tenant + Date */}
              <View style={styles.cardBottom}>
                <View style={styles.tenantRow}>
                  <Ionicons name="person-outline" size={14} color="#6B7280" />
                  <Text style={styles.tenantName}>{inspection.tenant?.full_name || 'Tenant'}</Text>
                </View>
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                  <Text style={styles.dateText}>{formatDate(inspection.scheduled_date)}</Text>
                </View>
              </View>

              {/* Arrow */}
              <View style={styles.arrowContainer}>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* FAB */}
      {!loading && filtered.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(owner)/inspections/new' as any)}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#111827' },
  scheduleBtn: {
    backgroundColor: RSA.blue,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterScroll: { maxHeight: 52, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: RSA.blue, borderColor: RSA.blue },
  chipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  chipTextActive: { color: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 12 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  scheduleEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: RSA.blue,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 20,
  },
  scheduleEmptyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    position: 'relative',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  propertyName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  propertyAddress: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tenantRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tenantName: { fontSize: 13, color: '#4B5563' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 13, color: '#4B5563' },
  arrowContainer: { position: 'absolute', right: 12, top: '50%', marginTop: -9 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: RSA.blue,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
});
