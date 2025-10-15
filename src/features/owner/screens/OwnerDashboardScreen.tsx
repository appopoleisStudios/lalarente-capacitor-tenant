import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';
import { PortfolioCard } from '../components/PortfolioCard';
import { AnalyticsGrid } from '../components/AnalyticsGrid';
import { DocumentsSection } from '../components/DocumentsSection';
import { MaintenanceSection } from '../components/MaintenanceSection';
import { ApplicantsSection } from '../components/ApplicantsSection';
import { ActivitySection } from '../components/ActivitySection';
import { styles } from './OwnerDashboardScreen.styles';

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
