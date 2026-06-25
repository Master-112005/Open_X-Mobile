import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing } from '../styles/theme';

export default function ConnectionStatus({ status }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const statusPresentation = {
    connecting: { label: 'Connecting', color: colors.warning, badge: 'LINKING' },
    connected: { label: 'Connected', color: colors.success, badge: 'LIVE' },
    disconnected: { label: 'Waiting for OpenX Desktop...', color: colors.danger, badge: 'WAITING' },
    reconnecting: { label: 'Reconnecting', color: colors.warning, badge: 'RETRYING' },
    error: { label: 'Waiting for OpenX Desktop...', color: colors.danger, badge: 'WAITING' },
  }[status] ?? { label: 'Disconnected', color: colors.danger, badge: 'OFFLINE' };

  useEffect(() => {
    let animation;
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active || reduceMotion) return;
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            duration: 1100,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            duration: 1100,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
    });

    return () => {
      active = false;
      animation?.stop();
      pulse.setValue(0);
    };
  }, [pulse, status]);

  return (
    <LinearGradient
      accessibilityLabel={`Desktop status: ${statusPresentation.label}`}
      colors={['rgba(24,34,56,0.96)', 'rgba(14,21,38,0.96)']}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.container}
    >
      <View style={styles.indicatorShell}>
        <Animated.View
          style={[
            styles.pulse,
            {
              backgroundColor: statusPresentation.color,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.34] }),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) },
              ],
            },
          ]}
        />
        <View style={[styles.indicator, { backgroundColor: statusPresentation.color }]} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>OPENX DESKTOP</Text>
        <Text style={styles.value}>{statusPresentation.label}</Text>
      </View>
      <View style={styles.liveBadge}>
        <Text style={styles.liveText}>{statusPresentation.badge}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    ...shadows.card,
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  indicatorShell: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 20,
  },
  pulse: { borderRadius: radius.round, height: 12, position: 'absolute', width: 12 },
  indicator: { borderRadius: radius.round, height: 9, width: 9 },
  copy: { flex: 1 },
  label: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  value: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 3 },
  liveBadge: {
    backgroundColor: 'rgba(124,145,255,0.13)',
    borderColor: 'rgba(124,145,255,0.25)',
    borderRadius: radius.round,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  liveText: {
    color: colors.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
