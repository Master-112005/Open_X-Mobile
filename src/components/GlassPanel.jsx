import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { colors, glassSurface, gradients, radius, spacing } from '../styles/theme';

export default function GlassPanel({ children, style, contentStyle }) {
  return (
    <LinearGradient
      colors={gradients.glass}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.panel, style]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
        pointerEvents="none"
        style={styles.edge}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.12)']}
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
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  edge: {
    height: 1,
    left: spacing.sm,
    position: 'absolute',
    right: spacing.sm,
    top: 0,
  },
});
