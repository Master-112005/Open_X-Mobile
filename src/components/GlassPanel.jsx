import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { glassSurface, gradients, radius, spacing } from '../styles/theme';

export default function GlassPanel({ children, style, contentStyle }) {
  return (
    <LinearGradient
      colors={gradients.glass}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.panel, style]}
    >
      <LinearGradient
        colors={gradients.glassSoft}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
        pointerEvents="none"
        style={styles.edge}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
        pointerEvents="none"
        style={styles.inner}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.18)']}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View style={contentStyle}>
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  panel: {
    ...glassSurface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  edge: {
    height: 1,
    left: spacing.sm,
    position: 'absolute',
    right: spacing.sm,
    top: 0,
  },
  inner: {
    bottom: 1,
    left: 1,
    position: 'absolute',
    right: 1,
    top: 1,
  },
});
