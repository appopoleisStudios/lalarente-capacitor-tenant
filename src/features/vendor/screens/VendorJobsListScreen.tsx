import { useAuth } from '@/src/contexts/AuthContext';
import {
  getVendorAvailableRequests,
  getVendorMyJobs,
  type VendorMaintenanceRequest
} from '@/src/features/maintenance/api';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { JobCard } from '../components/JobCard';

type TabType = 'active' | 'completed';

export default function VendorJobsListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [jobs, setJobs] = useState<VendorMaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch jobs
  const fetchJobs = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      if (activeTab === 'active') {
        // Get active jobs (assigned or in_progress)
        const data = await getVendorMyJobs(profile.id);
        setJobs(data);
      } else {
        // Get completed jobs
        const data = await getVendorAvailableRequests(profile.id, {
          status: 'completed',
        });
        // Filter to only show jobs where vendor was selected
        const completedJobs = data.filter((job: VendorMaintenanceRequest) => job.selected_vendor_id === profile.id);
        setJobs(completedJobs);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  };

  // Fetch on mount and tab change
  useEffect(() => {
    fetchJobs();
  }, [activeTab, profile?.id]);

  // Filter jobs based on search query
  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;

    const query = searchQuery.toLowerCase();
    return jobs.filter(job => {
      // Search in title
      if (job.title.toLowerCase().includes(query)) return true;

      // Search in property address
      if (job.property?.address?.toLowerCase().includes(query)) return true;
      if (job.property?.city?.toLowerCase().includes(query)) return true;

      // Search in PO number
      if (job.po_id?.toLowerCase().includes(query)) return true;

      return false;
    });
  }, [jobs, searchQuery]);

  // Handle job press
  const handleJobPress = (jobId: string) => {
    router.push(`/(vendor)/jobs/${jobId}`);
  };

  // Render tab button
  const renderTabButton = (tab: TabType, label: string) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        style={[styles.tabButton, isActive && styles.tabButtonActive]}
        onPress={() => setActiveTab(tab)}
      >
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    if (loading) return null;

    // If searching and no results
    if (searchQuery.trim() && filteredJobs.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Results Found</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting your search terms
          </Text>
        </View>
      );
    }

    // Default empty state
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name={activeTab === 'active' ? 'hammer-outline' : 'checkmark-done-circle-outline'}
          size={64}
          color={colors.gray[300]}
        />
        <Text style={styles.emptyTitle}>
          {activeTab === 'active' ? 'No Active Jobs' : 'No Completed Jobs'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === 'active'
            ? 'Your accepted jobs will appear here'
            : 'Your completed jobs will appear here'}
        </Text>
      </View>
    );
  };

  // Render job item
  const renderJobItem = ({ item }: { item: VendorMaintenanceRequest }) => (
    <JobCard job={item} onPress={() => handleJobPress(item.id)} />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Jobs</Text>
        <Text style={styles.headerSubtitle}>
          {filteredJobs.length} {activeTab === 'active' ? 'active' : 'completed'} job{filteredJobs.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {renderTabButton('active', 'Active')}
        {renderTabButton('completed', 'Completed')}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.gray[400]} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search jobs..."
          placeholderTextColor={colors.gray[400]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color={colors.gray[400]} />
          </TouchableOpacity>
        )}
      </View>

      {/* Jobs List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.rsa.blue} />
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          renderItem={renderJobItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.rsa.blue}
              colors={[colors.rsa.blue]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.gray[600],
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.background.default,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.rsa.blue,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray[600],
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 20,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.gray[500],
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.gray[500],
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: colors.text.primary,
  },
  clearButton: {
    padding: 4,
  },
});
