import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [showLaunch, setShowLaunch] = useState(true);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
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
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        duration: 260,
        toValue: 0,
        useNativeDriver: true,
      }).start(() => setShowLaunch(false));
    }, 1050);

    return () => clearTimeout(timer);
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
});
