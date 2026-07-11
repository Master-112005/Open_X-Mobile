import { StatusBar } from 'expo-status-bar';
import { Component, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';

class AppErrorBoundary extends Component {
  state = { error: null, recoveryKey: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('OpenX Mobile recovered from a render failure.', error, info?.componentStack || '');
  }

  recover = () => {
    this.setState((current) => ({ error: null, recoveryKey: current.recoveryKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <SafeAreaProvider>
          <View style={styles.recovery}>
            <Text style={styles.recoveryTitle}>OpenX needs to recover</Text>
            <Text style={styles.recoveryText}>The mobile interface hit an unexpected error. Your pairing and transfer history remain saved.</Text>
            <Pressable accessibilityRole="button" onPress={this.recover} style={styles.recoveryButton}>
              <Text style={styles.recoveryButtonText}>Restart interface</Text>
            </Pressable>
          </View>
        </SafeAreaProvider>
      );
    }
    return <AppRuntime key={this.state.recoveryKey} />;
  }
}

function AppRuntime() {
  const [showLaunch, setShowLaunch] = useState(true);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    const launchAnimation = Animated.parallel([
      Animated.timing(opacity, {
        duration: 360,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        damping: 18,
        stiffness: 120,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);
    launchAnimation.start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        duration: 260,
        toValue: 0,
        useNativeDriver: true,
      }).start(() => setShowLaunch(false));
    }, 500);

    return () => {
      clearTimeout(timer);
      launchAnimation.stop();
    };
  }, [opacity, scale]);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <AppNavigator />
        {showLaunch ? (
          <View pointerEvents="none" style={styles.launch}>
            <Animated.View style={[styles.launchMark, { opacity, transform: [{ scale }] }]}>
              <Text style={styles.launchTitle}>Open_X</Text>
              <Text style={styles.launchSubtitle}>Mobile</Text>
            </Animated.View>
          </View>
        ) : null}
      </AppProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  return <AppErrorBoundary />;
}

const styles = StyleSheet.create({
  launch: {
    alignItems: 'center',
    backgroundColor: '#000000',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  launchMark: { alignItems: 'center' },
  launchTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  launchSubtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 8,
  },
  recovery: {
    alignItems: 'center',
    backgroundColor: '#070B14',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  recoveryTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  recoveryText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    textAlign: 'center',
  },
  recoveryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  recoveryButtonText: {
    color: '#070B14',
    fontSize: 14,
    fontWeight: '800',
  },
});
