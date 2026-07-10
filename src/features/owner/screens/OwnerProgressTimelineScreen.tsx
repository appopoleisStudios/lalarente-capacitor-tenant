import {
  getMaintenanceRequestById,
  getProgressUpdates,
} from '@/src/features/maintenance/api';
import { MediaGallery } from '@/src/features/maintenance/components/MediaGallery';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RSA = { blue: '#002395' };

interface ProgressUpdateItem {
  id: string;
  maintenance_request_id: string;
  vendor_id: string;
  update_date: string;
  notes: string;
  photos: string[];
  created_at: string;
}

export default function OwnerProgressTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const abortRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdateItem[]>([]);

  useEffect(() => {
    if (id) {
      abortRef.current = new AbortController();
      loadData();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      const req = await getMaintenanceRequestById(id);
      if (abortRef.current?.signal.aborted) return;
      setRequest(req);

      const updates = await getProgressUpdates(id);
      if (abortRef.current?.signal.aborted) return;
      setProgressUpdates(updates || []);
    } catch (error: any) {
      console.error('Error loading progress timeline:', error);
      Alert.alert('Error', error.message || 'Failed to load progress updates');
    } finally {
      setLoading(false);
    }
  };

  const vendor = (request as any)?.selected_vendor;
  const hasUpdates = progressUpdates.length > 0;
  const totalPhotos = progressUpdates.reduce((sum, u) => sum + (u.photos?.length || 0), 0);

  const renderUpdateItem = ({ item, index }: { item: ProgressUpdateItem; index: number }) => {
    const isLatest = index === 0;
    const date = new Date(item.update_date || item.created_at);
    const formattedDate = date.toLocaleDateString('en-ZA', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <View style={styles.updateCard}>
        {/* Timeline connector */}
        <View style={styles.updateHeader}>
          <View style={[styles.timelineDot, isLatest && styles.timelineDotLatest]}>
            <View style={[styles.timelineInner, isLatest && styles.timelineInnerLatest]} />
          </View>
          <View style={styles.updateMeta}>
            <Text style={styles.updateDate}>
              {isLatest ? 'Latest Update · ' : ''}{formattedDate}
            </Text>
            <Text style={styles.updateNumber}>
              Update #{progressUpdates.length - index}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {item.notes ? (
          <View style={styles.notesContainer}>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        ) : (
          <Text style={styles.noNotes}>No notes provided for this update.</Text>
        )}

        {/* Photos */}
        {item.photos && item.photos.length > 0 && (
          <View style={styles.photosContainer}>
            <Text style={styles.photosLabel}>
              {item.photos.length} photo{item.photos.length > 1 ? 's' : ''}
            </Text>
            <MediaGallery images={item.photos} />
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.blue} />
          <Text style={styles.loadingText}>Loading progress updates...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Progress Updates</Text>
          <Text style={styles.headerSubtitle}>
            {hasUpdates
              ? `${progressUpdates.length} update${progressUpdates.length > 1 ? 's' : ''}, ${totalPhotos} photo${totalPhotos !== 1 ? 's' : ''}`
              : 'No updates yet'}
          </Text>
        </View>
      </View>

      {/* Vendor info bar */}
      {vendor && (
        <View style={styles.vendorBar}>
          <View style={styles.vendorAvatar}>
            <Ionicons name="business" size={18} color={RSA.blue} />
          </View>
          <Text style={styles.vendorBarText}>
            {vendor.full_name || 'Vendor'}
          </Text>
        </View>
      )}

      <FlatList
        data={progressUpdates}
        keyExtractor={item => item.id}
        renderItem={renderUpdateItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={56} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No Progress Updates Yet</Text>
            <Text style={styles.emptyText}>
              Once the vendor starts submitting daily progress updates, they will appear here in chronological order.
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitleContainer: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  // Vendor bar
  vendorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f0f5ff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  vendorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorBarText: { fontSize: 14, fontWeight: '600', color: RSA.blue, flex: 1 },

  // List
  listContent: { padding: 16 },

  // Update card
  updateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12,
  },
  updateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotLatest: {
    backgroundColor: RSA.blue,
  },
  timelineInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RSA.blue,
  },
  timelineInnerLatest: {
    backgroundColor: '#FFFFFF',
  },
  updateMeta: { flex: 1 },
  updateDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  updateNumber: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },

  // Notes
  notesContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  noNotes: {
    fontSize: 13,
    color: colors.gray[400],
    fontStyle: 'italic',
    marginBottom: 12,
  },

  // Photos
  photosContainer: {
    gap: 8,
  },
  photosLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
