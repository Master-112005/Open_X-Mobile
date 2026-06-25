import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { colors } from '../styles/theme';

export default function ScreenBackground({ children, style }) {
  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={[colors.background, colors.backgroundAlt, colors.background]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.glow, styles.glowTop]} />
      <View pointerEvents="none" style={[styles.glow, styles.glowBottom]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1, overflow: 'hidden' },
  glow: {
    borderRadius: 999,
    opacity: 0.12,
    position: 'absolute',
  },
  glowTop: {
    backgroundColor: colors.primary,
    height: 260,
    right: -150,
    top: -110,
    width: 260,
  },
  glowBottom: {
    backgroundColor: colors.accent,
    bottom: -180,
    height: 300,
    left: -190,
    width: 300,
  },
});
