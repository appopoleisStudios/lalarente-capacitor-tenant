import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';
import { formatDate } from '@/src/shared/utils/format';

const RSA = { blue: '#002395' };

interface TimelineItemProps {
  icon: string;
  label: string;
  date: string;
  completed: boolean;
}

function TimelineItem({ icon, label, date, completed }: TimelineItemProps) {
  return (
    <View style={styles.timelineItem}>
      <View style={[styles.timelineIcon, completed && styles.timelineIconCompleted]}>
        <Ionicons name={icon as any} size={16} color={completed ? '#FFFFFF' : colors.gray[400]} />
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineLabel}>{label}</Text>
        <Text style={styles.timelineDate}>{date}</Text>
      </View>
    </View>
  );
}

interface RequestTimelineSectionProps {
  request: any;
  quotes: any[];
  purchaseOrder: any;
}

export function RequestTimelineSection({
  request,
  quotes,
  purchaseOrder,
}: RequestTimelineSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Timeline</Text>
      <View style={styles.timeline}>
        <TimelineItem
          icon="add-circle"
          label="Created"
          date={formatDate(request.created_at)}
          completed
        />
        {request.acknowledged_at && (
          <TimelineItem
            icon="checkmark-circle"
            label="Acknowledged"
            date={formatDate(request.acknowledged_at)}
            completed
          />
        )}
        {request.vendor_routed_at && (
          <TimelineItem
            icon="people"
            label="Sent to Vendors"
            date={formatDate(request.vendor_routed_at)}
            completed
          />
        )}
        {quotes && quotes.length > 0 && (
          <TimelineItem
            icon="document-text"
            label={`Quote${quotes.length > 1 ? 's' : ''} Received (${quotes.length})`}
            date={formatDate(quotes[0].created_at)}
            completed
          />
        )}
        {purchaseOrder && (
          <TimelineItem
            icon="receipt"
            label="Purchase Order Issued"
            date={formatDate(purchaseOrder.created_at)}
            completed
          />
        )}
        {request.status === 'in_progress' && (
          <TimelineItem
            icon="construct"
            label="Work In Progress"
            date={request.scheduled_date ? formatDate(request.scheduled_date) : 'In Progress'}
            completed
          />
        )}
        {request.completed_date && (
          <TimelineItem
            icon="checkmark-done"
            label="Completed"
            date={formatDate(request.completed_date)}
            completed
          />
        )}
        {request.status === 'closed' && !request.completed_date && (
          <TimelineItem icon="archive" label="Closed" date={formatDate(new Date())} completed />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
  },
  timeline: {
    gap: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconCompleted: {
    backgroundColor: RSA.blue,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  timelineDate: {
    fontSize: 12,
    color: colors.gray[600],
    marginTop: 2,
  },
});
