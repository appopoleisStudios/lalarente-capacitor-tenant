import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { env } from '@/src/core/config/env';
import { sanitizeForSentry } from '@/src/core/observability/sentry';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Raw error is not logged to avoid PII leaking into Sentry breadcrumbs
    // (Sentry SDK captures console.error calls as breadcrumbs by default).
    console.error('[ErrorBoundary] rendering fallback; details forwarded to Sentry sanitized');
    if (env.sentry.dsn) {
      Sentry.captureException(sanitizeForSentry(error), {
        extra: { componentStack: info.componentStack },
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>{this.state.error?.message}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#111',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#d97706',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
