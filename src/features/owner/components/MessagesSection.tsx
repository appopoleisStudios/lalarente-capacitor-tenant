import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedButton } from './AnimatedButton';

interface MessageThread {
  id: string;
  tenant_name: string;
  subject: string;
  unread_count: number;
  last_message_at: string | null;
  category: string;
}

interface MessagesSectionProps {
  threads: MessageThread[];
  totalUnread: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  maintenance: '#FF9800',
  payment: '#4CAF50',
  lease: '#9C27B0',
  emergency: '#F44336',
  general: '#2196F3',
};

const formatTime = (dateString: string | null) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString('en-ZA', { weekday: 'short' });
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
};

export const MessagesSection = ({ threads, totalUnread }: MessagesSectionProps) => {
  const router = useRouter();

  if (threads.length === 0) return null;

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Messages</Text>
          {totalUnread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
            </View>
          )}
        </View>
        <AnimatedButton onPress={() => router.push('/(owner)/messages' as any)}>
          <Text style={styles.seeAll}>See All</Text>
        </AnimatedButton>
      </View>

      {threads.slice(0, 3).map(thread => {
        const categoryColor = CATEGORY_COLORS[thread.category] ?? CATEGORY_COLORS.general;
        const isUnread = thread.unread_count > 0;

        return (
          <AnimatedButton
            key={thread.id}
            style={styles.card}
            onPress={() => router.push(`/(owner)/messages/${thread.id}` as any)}
          >
            <View style={[styles.cardInner, isUnread && styles.cardUnread]}>
              {/* Avatar / category indicator */}
              <View style={[styles.iconContainer, { backgroundColor: categoryColor + '20' }]}>
                <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
                <Ionicons name="chatbubble-outline" size={18} color={categoryColor} />
              </View>

              {/* Content */}
              <View style={styles.info}>
                <Text style={[styles.tenantName, isUnread && styles.bold]} numberOfLines={1}>
                  {thread.tenant_name}
                </Text>
                <Text style={[styles.subject, isUnread && styles.bold]} numberOfLines={1}>
                  {thread.subject}
                </Text>
              </View>

              {/* Right side */}
              <View style={styles.right}>
                <Text style={styles.time}>{formatTime(thread.last_message_at)}</Text>
                {isUnread && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {thread.unread_count > 99 ? '99+' : thread.unread_count}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </AnimatedButton>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#002395',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: '#002395',
  },
  card: {
    marginBottom: 8,
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardUnread: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#002395',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative',
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 2,
    right: 2,
  },
  info: {
    flex: 1,
  },
  tenantName: {
    fontSize: 13,
    color: '#111827',
  },
  subject: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  bold: {
    fontWeight: '700',
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  time: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  unreadBadge: {
    backgroundColor: '#002395',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
});
