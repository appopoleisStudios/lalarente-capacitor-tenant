import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from './AnimatedButton';

const RSA = { blue: '#002395', green: '#007A4D' };

type FilterType = 'all' | 'open' | 'assigned' | 'in_progress' | 'completed';

interface MaintenanceFiltersProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: {
    all: number;
    open: number;
    assigned: number;
    in_progress: number;
    completed: number;
  };
}

export const MaintenanceFilters = ({
  activeFilter,
  onFilterChange,
  counts,
}: MaintenanceFiltersProps) => {
  const filters = [
    { key: 'all' as FilterType, label: 'All', count: counts.all },
    { key: 'open' as FilterType, label: 'Open', count: counts.open },
    { key: 'assigned' as FilterType, label: 'Assigned', count: counts.assigned },
    { key: 'in_progress' as FilterType, label: 'In Progress', count: counts.in_progress },
    { key: 'completed' as FilterType, label: 'Completed', count: counts.completed },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filters.map((filter) => (
          <AnimatedButton
            key={filter.key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onFilterChange(filter.key);
            }}
          >
            <View
              style={[
                styles.chip,
                activeFilter === filter.key && styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  activeFilter === filter.key && styles.chipTextActive,
                ]}
              >
                {filter.label}
              </Text>
              {filter.count > 0 && (
                <View
                  style={[
                    styles.badge,
                    activeFilter === filter.key && styles.badgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      activeFilter === filter.key && styles.badgeTextActive,
                    ]}
                  >
                    {filter.count}
                  </Text>
                </View>
              )}
            </View>
          </AnimatedButton>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: {
    backgroundColor: RSA.green,
    borderColor: RSA.green,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  badgeTextActive: {
    color: '#ffffff',
  },
});
