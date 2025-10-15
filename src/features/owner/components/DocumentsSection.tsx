import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedButton } from './AnimatedButton';

interface Document {
  name: string;
  icon: string;
  type: string;
  info: string;
}

interface DocumentsSectionProps {
  documents: Document[];
}

export const DocumentsSection = ({ documents }: DocumentsSectionProps) => {
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>My Documents</Text>
        <AnimatedButton>
          <Text style={styles.seeAll}>See All</Text>
        </AnimatedButton>
      </View>
      <View style={styles.grid}>
        {documents.map((doc) => (
          <AnimatedButton key={doc.type} style={styles.card}>
            <View style={styles.cardInner}>
              <Text style={styles.icon}>{doc.icon}</Text>
              <Text style={styles.name} numberOfLines={2}>{doc.name}</Text>
              <Text style={styles.info}>{doc.info}</Text>
            </View>
          </AnimatedButton>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  seeAll: { fontSize: 13, fontWeight: '600', color: '#002395' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card: { width: '31%' },
  cardInner: { backgroundColor: '#ffffff', borderRadius: 12, padding: 10, alignItems: 'center', minHeight: 100, elevation: 1 },
  icon: { fontSize: 22, marginBottom: 6 },
  name: { fontSize: 10, fontWeight: '600', color: '#111827', textAlign: 'center', marginBottom: 4 },
  info: { fontSize: 9, color: '#6b7280', textAlign: 'center' },
});
