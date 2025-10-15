import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from '../src/shared/components/ui/Button';
import { Input } from '../src/shared/components/ui/Input';
import { Card } from '../src/shared/components/ui/Card';
import { LoadingSpinner } from '../src/shared/components/ui/LoadingSpinner';

export default function TestComponentsScreen() {
  const [email, setEmail] = useState('');

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Component Test Screen</Text>
      
      <View style={styles.section}>
        <Card>
          <Text>This is a card component</Text>
        </Card>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.label}>Email</Text>
        <Input
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
        />
      </View>
      
      <View style={styles.section}>
        <Button onPress={() => alert('Primary pressed')}>
          <Text style={{ color: '#fff' }}>Primary Button</Text>
        </Button>
      </View>
      
      <View style={styles.section}>
        <Button variant="secondary" onPress={() => alert('Secondary pressed')}>
          <Text style={{ color: '#fff' }}>Secondary Button</Text>
        </Button>
      </View>
      
      <View style={styles.section}>
        <Button variant="outline" onPress={() => alert('Outline pressed')}>
          <Text style={{ color: '#0ea5e9' }}>Outline Button</Text>
        </Button>
      </View>
      
      <View style={styles.section}>
        <LoadingSpinner />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
});
