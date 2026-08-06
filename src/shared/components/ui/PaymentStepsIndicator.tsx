import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * PaymentStepsIndicator
 *
 * Honest 3-step progress for the tenant pay-vendor flow:
 *
 *   Review  →  Pay  →  Done
 *
 * The `current` prop marks the step the user is ON right now (rendered as the
 * active step). Steps before it are done (✓), steps after it are still to do.
 * When `error` is set the active step renders red to signal a failed attempt.
 *
 * Screens:
 *   - invoice review   (vendor-payments/[invoiceId]) → current={0}
 *   - secure checkout  (vendor-payments/checkout)    → current={1}
 *   - result           (vendor-payments/result)      → current={2} (or {1} + error)
 */
export function PaymentStepsIndicator({
  current,
  error = false,
}: {
  current: 0 | 1 | 2;
  error?: boolean;
}) {
  const steps = ['Review', 'Pay', 'Done'];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const circleBg = done ? '#007A4D' : active ? (error ? '#DE3831' : '#007A4D') : '#E5E5E5';
          const circleText = done || active ? '#FFF' : '#999';
          const symbol = done ? '✓' : active && error ? '!' : String(i + 1);
          const labelColor = active ? (error ? '#DE3831' : '#007A4D') : done ? '#333' : '#999';

          return (
            <React.Fragment key={label}>
              {i > 0 && (
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: i - 1 < current ? '#007A4D' : '#E5E5E5' },
                  ]}
                />
              )}
              <View style={styles.step}>
                <View style={[styles.circle, { backgroundColor: circleBg }]}>
                  <Text style={[styles.circleText, { color: circleText }]}>{symbol}</Text>
                </View>
                <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFF',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  step: {
    alignItems: 'center',
    width: 64,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  circleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  connector: {
    width: 28,
    height: 2,
    marginTop: 13,
  },
});
