import { getInvoiceAuditLog } from '@/src/features/maintenance/api';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = { invoiceId: string };

export function InvoiceHistory({ invoiceId }: Props) {
  const [rows, setRows] = useState<{ event: string; created_at: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    getInvoiceAuditLog(invoiceId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => console.error('Invoice history load failed:', err));
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  if (!rows.length) return null;

  return (
    <View style={styles.wrap} testID="invoice-history">
      <Text style={styles.title}>History</Text>
      {rows.map((row, index) => (
        <Text key={`${row.created_at}-${index}`} style={styles.line}>
          {String(row.created_at).slice(0, 16).replace('T', ' ')} · {row.event.replace(/_/g, ' ')}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 8 },
  line: { fontSize: 12, color: '#4B5563', marginBottom: 4 },
});
