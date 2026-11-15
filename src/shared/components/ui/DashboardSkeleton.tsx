import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/shared/theme/colors';

type Width = number | `${number}%`;

function Block({
  pulse,
  h,
  w = '100%',
  r = 12,
}: {
  pulse: Animated.Value;
  h: number;
  w?: Width;
  r?: number;
}) {
  return (
    <Animated.View
      style={[styles.block, { height: h, width: w, borderRadius: r, opacity: pulse }]}
    />
  );
}

/**
 * Dashboard placeholder shown while the first data loads (CT7-026): the real
 * header paints instantly with grey blocks where the cards will be, instead
 * of a blank full-screen spinner.
 *
 * `variant` matches each dashboard's real header so nothing jumps when the
 * data arrives: owner = bold title with a divider, tenant = small greeting
 * line above the name.
 */
export function DashboardSkeleton({
  title,
  subtitle,
  variant = 'owner',
}: {
  title: string;
  subtitle?: string;
  variant?: 'owner' | 'tenant';
}) {
  const pulse = useRef(new Animated.Value(0.6)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <View
      style={styles.container}
      testID="dashboard-skeleton"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading dashboard"
      accessibilityState={{ busy: true }}
    >
      {variant === 'tenant' ? (
        <View style={styles.tenantHeader}>
          <Text style={styles.greeting}>{title}</Text>
          <Block pulse={pulse} h={28} w="55%" r={8} />
        </View>
      ) : (
        <View style={styles.ownerHeader}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      )}
      <View style={styles.body}>
        <Block pulse={pulse} h={150} r={20} />
        <Block pulse={pulse} h={84} r={16} />
        <View style={styles.row}>
          <Block pulse={pulse} h={110} w="48%" />
          <Block pulse={pulse} h={110} w="48%" />
        </View>
        <Block pulse={pulse} h={64} />
        <Block pulse={pulse} h={64} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
  ownerHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  tenantHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 6 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text.primary },
  subtitle: { fontSize: 15, color: colors.text.secondary, marginTop: 2 },
  greeting: { fontSize: 14, color: colors.text.secondary },
  body: { padding: 20, gap: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  block: { backgroundColor: colors.gray[200] },
});
