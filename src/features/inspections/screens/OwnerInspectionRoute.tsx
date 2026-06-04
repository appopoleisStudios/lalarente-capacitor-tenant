import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import InspectionScreen from './InspectionScreen';
import OwnerInspectionDetailScreen from './OwnerInspectionDetailScreen';
import { inspectionsApi } from '../api/inspectionsApi';

const VIEW_ONLY_STATUSES = new Set(['completed', 'cancelled']);

export default function OwnerInspectionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const inspectionId = Array.isArray(id) ? id[0] : id;
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!inspectionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await inspectionsApi.getInspection(inspectionId);
        if (!cancelled) setStatus(data.status ?? 'scheduled');
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inspectionId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#002395" />
      </View>
    );
  }

  if (!inspectionId || (status && VIEW_ONLY_STATUSES.has(status))) {
    return <OwnerInspectionDetailScreen />;
  }

  return <InspectionScreen role="owner" />;
};
