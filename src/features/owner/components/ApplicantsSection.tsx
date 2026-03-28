import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { AnimatedButton } from './AnimatedButton';

interface Applicant {
  id?: string;
  avatar: string;
  name: string;
  property: string;
  status: string;
  date: string;
}

interface ApplicantsSectionProps {
  applicants: Applicant[];
}

export const ApplicantsSection = ({ applicants }: ApplicantsSectionProps) => {
  const router = useRouter();
  
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Applications</Text>
        <AnimatedButton onPress={() => router.push('/(owner)/applications' as any)}>
          <Text style={styles.seeAll}>See All</Text>
        </AnimatedButton>
      </View>
      {applicants.map((a, i) => (
        <AnimatedButton
          key={i}
          style={styles.card}
          onPress={() => a.id && router.push(`/(owner)/applications/${a.id}` as any)}
        >
          <View style={styles.cardInner}>
            {a.avatar ? (
              <Image source={{ uri: a.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{a.name?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.name}>{a.name}</Text>
              <Text style={styles.property}>{a.property}</Text>
            </View>
            <View style={[styles.status, { backgroundColor: a.status === 'Approved' ? '#d1fae5' : '#fef3c7' }]}>
              <Text style={[styles.statusText, { color: a.status === 'Approved' ? '#065f46' : '#92400e' }]}>{a.status}</Text>
            </View>
            <Text style={styles.date}>{a.date}</Text>
          </View>
        </AnimatedButton>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  seeAll: { fontSize: 13, fontWeight: '600', color: '#002395' },
  card: { marginBottom: 8 },
  cardInner: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '600', color: '#111827' },
  property: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  status: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 8 },
  statusText: { fontSize: 10, fontWeight: '600' },
  date: { fontSize: 10, color: '#9ca3af' },
  avatarPlaceholder: { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 14, fontWeight: '700', color: '#6b7280' },
});
