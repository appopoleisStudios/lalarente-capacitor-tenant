import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { inspectionsApi } from '../api/inspectionsApi';
import { supabase } from '../../../lib/supabase';
import { exportInspectionReportPdf } from '../../owner/utils/pdfReports';
import type { InspectionWithRelations, InspectionRooms, RoomInspection } from '../types';

const RSA = { blue: '#002395', gold: '#FFB81C' };

const CONDITION_COLOR: Record<string, string> = {
  excellent: '#10B981',
  good:      '#3B82F6',
  fair:      '#F59E0B',
  poor:      '#F97316',
  damaged:   '#EF4444',
};

const STATUS_COLOR: Record<string, string> = {
  scheduled:          '#3B82F6',
  in_progress:        '#F59E0B',
  pending_signatures: '#8B5CF6',
  completed:          '#10B981',
  cancelled:          '#6B7280',
};

const TYPE_LABEL: Record<string, string> = {
  move_in:  'Move-In Inspection',
  periodic: 'Periodic Inspection',
  move_out: 'Move-Out Inspection',
};

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function ConditionBadge({ value }: { value: string }) {
  const color = CONDITION_COLOR[value] ?? '#6B7280';
  return (
    <View style={[styles.condBadge, { backgroundColor: color + '20', borderColor: color }]}>
      <Text style={[styles.condBadgeText, { color }]}>
        {value.charAt(0).toUpperCase() + value.slice(1)}
      </Text>
    </View>
  );
}

export default function OwnerInspectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [inspection, setInspection] = useState<InspectionWithRelations | null>(null);
  const [rooms, setRooms] = useState<RoomInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expandedRoom, setExpandedRoom] = useState<number | null>(0);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [id])
  );

  const load = async () => {
    try {
      setLoading(true);
      const inspectionId = Array.isArray(id) ? id[0] : id;
      if (!inspectionId) return;
      const data = await inspectionsApi.getInspection(inspectionId);
      setInspection(data);
      const roomsData = data.rooms as InspectionRooms;
      setRooms(roomsData?.rooms ?? []);
    } catch (err) {
      console.error('Inspection load error:', err);
      Alert.alert('Error', 'Failed to load inspection details.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!inspection) return;
    try {
      setExporting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await exportInspectionReportPdf(inspection.id, user.id);
      Alert.alert('Report Saved', 'PDF report saved to your Documents.', [
        { text: 'View Documents', onPress: () => router.push('/(owner)/documents' as any) },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to generate PDF report.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RSA.blue} />
        </View>
      </SafeAreaView>
    );
  }

  if (!inspection) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color="#EF4444" />
          <Text style={styles.errorText}>Inspection not found</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const roomsData = inspection.rooms as InspectionRooms;
  const keys = roomsData?.keys;
  const generalNotes = roomsData?.generalNotes;
  const statusColor = STATUS_COLOR[inspection.status ?? 'scheduled'];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {TYPE_LABEL[inspection.type] ?? inspection.type}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {inspection.property?.title ?? ''}
          </Text>
        </View>
        {inspection.status === 'completed' && (
          <TouchableOpacity
            style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Ionicons name="download-outline" size={20} color="#FFF" />
            }
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Status card */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {(inspection.status ?? 'scheduled').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </Text>
            </View>
            {inspection.overall_condition && (
              <ConditionBadge value={inspection.overall_condition} />
            )}
          </View>

          <View style={[styles.rowBetween, { marginTop: 12 }]}>
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text style={styles.infoLabel}>Scheduled</Text>
              <Text style={styles.infoValue}>{fmt(inspection.scheduled_date)}</Text>
            </View>
            {inspection.completed_date && (
              <View style={styles.infoItem}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#6B7280" />
                <Text style={styles.infoLabel}>Completed</Text>
                <Text style={styles.infoValue}>{fmt(inspection.completed_date)}</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <View style={styles.infoItem}>
              <Ionicons name="person-outline" size={14} color="#6B7280" />
              <Text style={styles.infoLabel}>Tenant</Text>
              <Text style={styles.infoValue}>{inspection.tenant?.full_name ?? '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="business-outline" size={14} color="#6B7280" />
              <Text style={styles.infoLabel}>Property</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{inspection.property?.address ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Signatures</Text>
          <View style={styles.sigRow}>
            <View style={styles.sigItem}>
              <Ionicons
                name={inspection.owner_signed_at ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={inspection.owner_signed_at ? '#10B981' : '#D1D5DB'}
              />
              <View>
                <Text style={styles.sigName}>Owner</Text>
                <Text style={styles.sigDate}>
                  {inspection.owner_signed_at ? fmt(inspection.owner_signed_at) : 'Not signed'}
                </Text>
              </View>
            </View>
            <View style={styles.sigItem}>
              <Ionicons
                name={inspection.tenant_signed_at ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={inspection.tenant_signed_at ? '#10B981' : '#D1D5DB'}
              />
              <View>
                <Text style={styles.sigName}>Tenant</Text>
                <Text style={styles.sigDate}>
                  {inspection.tenant_signed_at ? fmt(inspection.tenant_signed_at) : 'Not signed'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Rooms */}
        {rooms.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Room Conditions ({rooms.length} rooms)</Text>
            {rooms.map((room, idx) => (
              <View key={idx}>
                <TouchableOpacity
                  style={styles.roomRow}
                  onPress={() => setExpandedRoom(expandedRoom === idx ? null : idx)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roomName}>{room.name}</Text>
                  </View>
                  <ConditionBadge value={room.overallCondition ?? 'good'} />
                  <Ionicons
                    name={expandedRoom === idx ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#9CA3AF"
                    style={{ marginLeft: 8 }}
                  />
                </TouchableOpacity>

                {expandedRoom === idx && (
                  <View style={styles.roomDetail}>
                    {room.notes ? (
                      <Text style={styles.roomNotes}>{room.notes}</Text>
                    ) : null}
                    {(room.items ?? []).map((item, iIdx) => (
                      <View key={iIdx}>
                        <View style={styles.itemRow}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <ConditionBadge value={item.condition ?? 'good'} />
                        </View>
                        {item.notes ? (
                          <Text style={styles.itemNotes}>{item.notes}</Text>
                        ) : null}
                        {(item.photos ?? []).length > 0 && (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.photoScroll}
                          >
                            {(item.photos ?? []).map((uri, pIdx) => (
                              <Image
                                key={pIdx}
                                source={{ uri }}
                                style={styles.photoThumb}
                              />
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    ))}
                    {/* Room-level photos */}
                    {(room.photos ?? []).length > 0 && (
                      <View style={styles.roomPhotosSection}>
                        <Text style={styles.roomPhotosLabel}>Room Photos</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {(room.photos ?? []).map((uri, pIdx) => (
                            <Image
                              key={pIdx}
                              source={{ uri }}
                              style={styles.photoThumb}
                            />
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}

                {idx < rooms.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        )}

        {/* Key Handover */}
        {keys && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Key Handover</Text>
            <View style={styles.keysGrid}>
              {keys.physicalKeys > 0 && (
                <View style={styles.keyItem}>
                  <Ionicons name="key-outline" size={20} color={RSA.blue} />
                  <Text style={styles.keyCount}>{keys.physicalKeys}</Text>
                  <Text style={styles.keyLabel}>Physical Keys</Text>
                </View>
              )}
              {keys.accessCards > 0 && (
                <View style={styles.keyItem}>
                  <Ionicons name="card-outline" size={20} color={RSA.blue} />
                  <Text style={styles.keyCount}>{keys.accessCards}</Text>
                  <Text style={styles.keyLabel}>Access Cards</Text>
                </View>
              )}
              {keys.remoteControls > 0 && (
                <View style={styles.keyItem}>
                  <Ionicons name="radio-button-on-outline" size={20} color={RSA.blue} />
                  <Text style={styles.keyCount}>{keys.remoteControls}</Text>
                  <Text style={styles.keyLabel}>Remotes</Text>
                </View>
              )}
            </View>
            {(keys.accessCodes ?? []).length > 0 && (
              <Text style={styles.accessCodes}>
                Access codes: {keys.accessCodes!.join(', ')}
              </Text>
            )}
          </View>
        )}

        {/* General Notes */}
        {generalNotes ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>General Notes</Text>
            <Text style={styles.generalNotes}>{generalNotes}</Text>
          </View>
        ) : null}

        {/* Export CTA for completed */}
        {inspection.status === 'completed' && (
          <TouchableOpacity
            style={[styles.exportCta, exporting && { opacity: 0.6 }]}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={20} color="#FFF" />
                <Text style={styles.exportCtaText}>Export PDF Report</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 16, color: '#374151', marginTop: 12 },
  retryBtn: { marginTop: 16, backgroundColor: RSA.blue, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6B7280', marginTop: 1 },
  exportBtn: {
    backgroundColor: RSA.blue,
    borderRadius: 20,
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },

  condBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  condBadgeText: { fontSize: 12, fontWeight: '700' },

  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  infoLabel: { fontSize: 12, color: '#9CA3AF' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },

  sigRow: { flexDirection: 'row', gap: 24 },
  sigItem: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  sigName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  sigDate: { fontSize: 12, color: '#6B7280', marginTop: 1 },

  roomRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
  },
  roomName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  roomDetail: { paddingBottom: 8, paddingLeft: 4 },
  roomNotes: { fontSize: 13, color: '#6B7280', marginBottom: 8, fontStyle: 'italic' },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: '#F9FAFB',
  },
  itemName: { fontSize: 13, color: '#4B5563', flex: 1 },
  itemNotes: { fontSize: 12, color: '#9CA3AF', marginLeft: 2, marginBottom: 4, fontStyle: 'italic' },
  photoScroll: { marginVertical: 6 },
  photoThumb: { width: 80, height: 60, borderRadius: 6, marginRight: 6, backgroundColor: '#F3F4F6' },
  roomPhotosSection: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8 },
  roomPhotosLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 6 },

  keysGrid: { flexDirection: 'row', gap: 16 },
  keyItem: { alignItems: 'center', gap: 4, flex: 1 },
  keyCount: { fontSize: 24, fontWeight: '800', color: RSA.blue },
  keyLabel: { fontSize: 11, color: '#6B7280', textAlign: 'center' },
  accessCodes: { fontSize: 13, color: '#4B5563', marginTop: 8 },

  generalNotes: { fontSize: 14, color: '#374151', lineHeight: 22 },

  exportCta: {
    backgroundColor: RSA.blue,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  exportCtaText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
