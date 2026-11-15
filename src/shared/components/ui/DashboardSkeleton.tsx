import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/shared/theme/colors';

/**
 * Dashboard placeholder shown while the first data loads (CT7-026): the real
 * header and title paint instantly with grey blocks where the cards will be,
 * instead of a blank full-screen spinner.
 */
export function DashboardSkeleton({ title, subtitle }: { title: string; subtitle?: string }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const Block = ({
    h,
    w = '100%',
    r = 12,
  }: {
    h: number;
    w?: number | `${number}%`;
    r?: number;
  }) => (
    <Animated.View
      style={[styles.block, { height: h, width: w, borderRadius: r, opacity: pulse }]}
    />
  );

  return (
    <View
      style={styles.container}
      testID="dashboard-skeleton"
      accessibilityLabel="Loading dashboard"
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>
        <Block h={150} r={20} />
        <Block h={84} r={16} />
        <View style={styles.row}>
          <Block h={110} w="48%" />
          <Block h={110} w="48%" />
        </View>
        <Block h={64} />
        <Block h={64} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.text.primary },
  subtitle: { fontSize: 15, color: colors.text.secondary, marginTop: 2 },
  body: { padding: 20, gap: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  block: { backgroundColor: colors.gray[200] },
});
