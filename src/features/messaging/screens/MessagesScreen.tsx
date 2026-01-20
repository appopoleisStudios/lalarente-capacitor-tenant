import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { messagesApi } from '../api/messagesApi';
import { ThreadWithRelations, ThreadFilter, CATEGORY_INFO, ThreadCategory } from '../types';
import { supabase } from '../../../lib/supabase';

const COLORS = {
  owner: { primary: '#002395', secondary: '#FFB81C' },
  tenant: { primary: '#007A4D', secondary: '#FFB81C' },
};

interface Props {
  role: 'owner' | 'tenant';
}

export default function MessagesScreen({ role = 'owner' }: Props) {
  const router = useRouter();
  const colors = COLORS[role];

  const [threads, setThreads] = useState<ThreadWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ThreadFilter>({ status: 'all' });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadThreads();
      // Subscribe to real-time updates
      const unsubscribe = messagesApi.subscribeToUserThreads(userId, role, handleThreadUpdate);
      return () => unsubscribe();
    }
  }, [userId, filter]);

  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadThreads = async () => {
    if (!userId) return;

    try {
      const data = await messagesApi.getUserThreads(userId, role, filter);
      setThreads(data);
    } catch (error) {
      console.error('Error loading threads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleThreadUpdate = (updatedThread: any) => {
    setThreads(prev => {
      const index = prev.findIndex(t => t.id === updatedThread.id);
      if (index >= 0) {
        const newThreads = [...prev];
        newThreads[index] = { ...newThreads[index], ...updatedThread };
        return newThreads.sort((a, b) =>
          new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
        );
      }
      return prev;
    });
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadThreads();
  }, [userId, filter]);

  const navigateToThread = (threadId: string) => {
    router.push(`/(${role})/messages/${threadId}`);
  };

  const getOtherParty = (thread: ThreadWithRelations) => {
    return role === 'owner' ? thread.tenant : thread.owner;
  };

  const getUnreadCount = (thread: ThreadWithRelations) => {
    return role === 'owner' ? thread.unread_count_owner : thread.unread_count_tenant;
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-ZA', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
    }
  };

  const renderThread = ({ item }: { item: ThreadWithRelations }) => {
    const otherParty = getOtherParty(item);
    const unreadCount = getUnreadCount(item) || 0;
    const category = item.category as ThreadCategory;
    const categoryInfo = CATEGORY_INFO[category] || CATEGORY_INFO.other;

    return (
      <TouchableOpacity
        style={[styles.threadCard, unreadCount > 0 && styles.threadCardUnread]}
        onPress={() => navigateToThread(item.id)}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {otherParty?.avatar_url ? (
            <Image source={{ uri: otherParty.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {otherParty?.full_name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          {/* Category Badge */}
          <View style={[styles.categoryBadge, { backgroundColor: categoryInfo.color }]}>
            <Ionicons name={categoryInfo.icon as any} size={10} color="#FFF" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.threadContent}>
          <View style={styles.threadHeader}>
            <Text style={[styles.threadName, unreadCount > 0 && styles.textBold]} numberOfLines={1}>
              {otherParty?.full_name || 'Unknown'}
            </Text>
            <Text style={styles.threadTime}>{formatTime(item.last_message_at)}</Text>
          </View>
          <Text style={[styles.threadSubject, unreadCount > 0 && styles.textBold]} numberOfLines={1}>
            {item.subject}
          </Text>
          {item.property && (
            <Text style={styles.threadProperty} numberOfLines={1}>
              <Ionicons name="home-outline" size={12} color="#999" /> {item.property.title}
            </Text>
          )}
        </View>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}

        <Ionicons name="chevron-forward" size={20} color="#CCC" />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color="#CCC" />
      <Text style={styles.emptyTitle}>No Messages</Text>
      <Text style={styles.emptyText}>
        {filter.status === 'all'
          ? "You don't have any conversations yet"
          : `No ${filter.status} conversations`}
      </Text>
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filterContainer}>
      {(['all', 'open', 'closed'] as const).map(status => (
        <TouchableOpacity
          key={status}
          style={[
            styles.filterButton,
            filter.status === status && { backgroundColor: colors.primary },
          ]}
          onPress={() => setFilter({ ...filter, status })}
        >
          <Text
            style={[
              styles.filterText,
              filter.status === status && { color: '#FFF' },
            ]}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          {/* Future: Add compose button */}
        </View>

        {/* Filters */}
        {renderFilters()}

        {/* Thread List */}
        <FlatList
          data={threads}
          keyExtractor={item => item.id}
          renderItem={renderThread}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={threads.length === 0 && styles.emptyList}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFF',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  threadCardUnread: {
    backgroundColor: '#F8FAFF',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  threadContent: {
    flex: 1,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  threadName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  threadTime: {
    fontSize: 12,
    color: '#999',
  },
  threadSubject: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  threadProperty: {
    fontSize: 12,
    color: '#999',
  },
  textBold: {
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: 8,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyList: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
