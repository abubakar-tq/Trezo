import AAWalletDebugScreen from '@/src/features/wallet/screens/AAWalletDebugScreen';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AAWalletDebugScreen Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Debug Screen Error</Text>
          <Text style={styles.errorText}>
            {this.state.error?.message || 'Unknown error occurred'}
          </Text>
          <Text style={styles.errorStack}>
            {this.state.error?.stack}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function AADebugScreenWithBoundary() {
  return (
    <ErrorBoundary>
      <AAWalletDebugScreen />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1a1a1a',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 12,
  },
  errorStack: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'monospace',
  },
});

