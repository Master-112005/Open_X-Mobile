import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { colors, gradients } from '../styles/theme';

export default function ScreenBackground({ children, style }) {
  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={gradients.appBackground}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={gradients.appBackgroundVeil}
        end={{ x: 0.8, y: 1 }}
        pointerEvents="none"
        start={{ x: 0.2, y: 0 }}
        style={styles.topVeil}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.035)']}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.bottomShade} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1, overflow: 'hidden' },
  topVeil: { height: '58%', left: 0, position: 'absolute', right: 0, top: 0 },
  bottomShade: {
    backgroundColor: 'rgba(0, 0, 0, 0.20)',
    bottom: 0,
    height: '42%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
