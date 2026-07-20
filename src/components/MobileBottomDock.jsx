import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SegmentedSlider from './SegmentedSlider';
import { colors, radius, spacing } from '../styles/theme';

export const MOBILE_BOTTOM_OPTIONS = [
  { label: 'Home', value: 'Home', iconName: 'sparkles-outline', activeIconName: 'sparkles', showLabel: false },
  { label: 'Files', value: 'Transfers', iconName: 'folder-open-outline', showLabel: false },
  { label: 'Calendar', value: 'Calendar', iconName: 'calendar-outline', showLabel: false },
  { label: 'Pair', value: 'QRPairing', iconName: 'qr-code-outline', showLabel: false },
  { label: 'Settings', value: 'Settings', iconName: 'settings-outline', showLabel: false },
];

export const MOBILE_BOTTOM_DOCK_CONTENT_HEIGHT = 62;

export function getMobileBottomDockHeight(insets = {}) {
  return Math.max(insets.bottom || 0, spacing.sm) + spacing.sm + MOBILE_BOTTOM_DOCK_CONTENT_HEIGHT;
}

export default function MobileBottomDock({
  activeRoute = 'Home',
  fixed = true,
  includeSafeArea = true,
  navigation,
  style,
}) {
  const insets = useSafeAreaInsets();
  const bottomInset = includeSafeArea ? Math.max(insets.bottom, spacing.sm) : 0;

  const handleNavigate = (routeName) => {
    if (!routeName || routeName === activeRoute) return;
    if (routeName === 'Home') {
      navigation?.popToTop?.();
      return;
    }
    navigation?.navigate?.(routeName);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        fixed ? styles.fixedDock : styles.inlineDock,
        includeSafeArea && { paddingBottom: bottomInset },
        style,
      ]}
    >
      <SegmentedSlider
        accessibilityLabel="OpenX mobile navigation"
        onChange={handleNavigate}
        options={MOBILE_BOTTOM_OPTIONS}
        segmentStyle={styles.segment}
        style={styles.slider}
        value={activeRoute}
      />
      <View style={styles.indicator} />
    </View>
  );
}

const styles = StyleSheet.create({
  fixedDock: {
    backgroundColor: colors.background,
    bottom: 0,
    left: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    position: 'absolute',
    right: 0,
    zIndex: 24,
  },
  inlineDock: {
    width: '100%',
  },
  slider: {
    minHeight: 50,
  },
  segment: {
    height: 42,
    paddingHorizontal: 4,
  },
  indicator: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius: radius.round,
    height: 4,
    marginTop: spacing.sm,
    width: 96,
  },
});
