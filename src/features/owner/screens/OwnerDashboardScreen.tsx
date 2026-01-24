import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';
import { PortfolioCard } from '../components/PortfolioCard';
import { AnalyticsGrid } from '../components/AnalyticsGrid';
import { DocumentsSection } from '../components/DocumentsSection';
import { MaintenanceSection } from '../components/MaintenanceSection';
import { ApplicantsSection } from '../components/ApplicantsSection';
import { ViewingRequestsSection } from '../components/ViewingRequestsSection';
import { ActivitySection } from '../components/ActivitySection';
import { styles } from './OwnerDashboardScreen.styles';
import { supabase } from '../../../lib/supabase';
import { viewingsApi } from '../../properties/api/viewingsApi';

const mockData = {
  user: { name: 'Thabo' },
  portfolio: { totalUnits: 10, occupied: 8, vacant: 2, monthIncome: 76000, arrears: 7000 },
  analytics: { monthIncome: 76000, currentOccupancy: 80, tenantsInArrears: 2, openMaintenance: 4 },
  maintenance: [
    { title: 'Geyser Burst', unit: 'Rosebank Lofts 5C', status: 'Open', quote: 2000, invoice: 2100 },
    { title: 'Leakage', unit: 'Sandton Villas 3A', status: 'Quote received', quote: 1250, invoice: null },
  ],
  documents: [
    { name: 'Lease Contracts', icon: '📄', type: 'lease', info: 'Active/Past' },
    { name: 'Invoices', icon: '💰', type: 'invoice', info: 'Latest' },
    { name: 'Vendor Quotes', icon: '📋', type: 'quote', info: 'For Review' },
    { name: 'Tax Reports', icon: '⚖️', type: 'tax', info: 'Annual' },
    { name: 'Compliance', icon: '🛡️', type: 'compliance', info: 'FICA/COC' },
  ],
  applicants: [
    { avatar: 'https://randomuser.me/api/portraits/women/44.jpg', name: 'Mpumi Ndlovu', property: 'Rosebank Lofts', status: 'Pending', date: '1h ago' },
    { avatar: 'https://randomuser.me/api/portraits/men/65.jpg', name: 'Malik Jacobs', property: 'Sandton View', status: 'Approved', date: '3h ago' },
  ],
  recentActivity: [
    { icon: '💰', label: 'Rent Received', value: 'R 12,000', date: 'Today' },
    { icon: '⚠️', label: 'Arrears Notice', value: 'Unit 207', date: '1h ago' },
    { icon: '🔧', label: 'New Maintenance', value: 'Rosebank', date: 'Yesterday' },
  ],
};

export default function OwnerDashboardScreen() {
  const router = useRouter();
  const [notificationCount] = useState(3);
  const [viewingRequests, setViewingRequests] = useState<any[]>([]);
  const [pendingViewingsCount, setPendingViewingsCount] = useState(0);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    initOwner();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (ownerId) {
        loadViewingRequests();
      }
    }, [ownerId])
  );

  const initOwner = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setOwnerId(user.id);
      loadViewingRequests(user.id);
    }
  };

  const loadViewingRequests = async (userId?: string) => {
    try {
      const ownerIdToUse = userId || ownerId;
      if (!ownerIdToUse) return;

      // Get recent viewing requests
      const viewings = await viewingsApi.getOwnerViewings(ownerIdToUse);

      // Get only pending and recent viewings for dashboard
      const recentViewings = viewings
        .filter(v => ['pending', 'approved'].includes(v.status))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      // Format for display
      const formattedViewings = await Promise.all(
        recentViewings.map(async (v) => {
          const { data: property } = await supabase
            .from('properties')
            .select('title')
            .eq('id', v.property_id)
            .single();

          const { data: tenant } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', v.tenant_id)
            .single();

          return {
            id: v.id,
            property_title: property?.title || 'Property',
            tenant_name: tenant?.full_name || 'Tenant',
            requested_date: v.requested_date,
            requested_time: v.requested_time,
            status: v.status,
          };
        })
      );

      setViewingRequests(formattedViewings);
      setPendingViewingsCount(viewings.filter(v => v.status === 'pending').length);
    } catch (error) {
      console.error('Error loading viewing requests:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AnimatedButton 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.back();
              }}
              hapticType="medium"
            >
              <View style={styles.backButtonInner}>
                <Text style={styles.backIcon}>←</Text>
              </View>
            </AnimatedButton>
            <View>
              <Text style={styles.headerTitle}>Portfolio Dashboard</Text>
              <Text style={styles.headerSubtitle}>Welcome back, {mockData.user.name}</Text>
            </View>
          </View>
          <AnimatedButton onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}>
            <View style={styles.notificationInner}>
              <Text style={styles.bellIcon}>🔔</Text>
              {notificationCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notificationCount}</Text>
                </View>
              )}
            </View>
          </AnimatedButton>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces alwaysBounceVertical>
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <PortfolioCard {...mockData.portfolio} userName={mockData.user.name} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <AnalyticsGrid {...mockData.analytics} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(500)}>
            <DocumentsSection documents={mockData.documents} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(500)}>
            <MaintenanceSection maintenance={mockData.maintenance} />
          </Animated.View>

          {viewingRequests.length > 0 && (
            <Animated.View entering={FadeInDown.delay(450).duration(500)}>
              <ViewingRequestsSection
                viewings={viewingRequests}
                pendingCount={pendingViewingsCount}
              />
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(500).duration(500)}>
            <ApplicantsSection applicants={mockData.applicants} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(600).duration(500)}>
            <ActivitySection activities={mockData.recentActivity} />
          </Animated.View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
