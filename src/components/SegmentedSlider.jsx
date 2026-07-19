import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing } from '../styles/theme';

export default function SegmentedSlider({
  accessibilityLabel,
  options = [],
  value,
  onChange,
  style,
  segmentStyle,
  textStyle,
}) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, style]}
    >
      {options.map((option) => {
        const optionValue = option.value ?? option.key ?? option.label;
        const selected = optionValue === value;
        const iconName = selected ? option.activeIconName || option.iconName : option.iconName;
        const showLabel = option.showLabel !== false || !iconName;
        return (
          <Pressable
            accessibilityLabel={option.accessibilityLabel || option.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            disabled={option.disabled}
            key={optionValue}
            onPress={() => onChange?.(optionValue)}
            style={({ pressed }) => [
              styles.segment,
              segmentStyle,
              selected && styles.segmentActive,
              pressed && styles.segmentPressed,
              option.disabled && styles.segmentDisabled,
            ]}
          >
            <View style={[styles.segmentContent, !showLabel && styles.segmentContentIconOnly]}>
              {iconName ? (
                <Ionicons
                  color={selected ? colors.background : colors.text}
                  name={iconName}
                  size={option.iconSize || (showLabel ? 18 : 22)}
                />
              ) : null}
              {showLabel ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.segmentText,
                    textStyle,
                    selected && styles.segmentTextActive,
                    option.disabled && styles.segmentTextDisabled,
                  ]}
                >
                  {option.label}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderColor: colors.borderBright,
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 54,
    overflow: 'hidden',
    padding: 3,
    width: '100%',
  },
  segment: {
    alignItems: 'center',
    borderRadius: radius.round,
    flex: 1,
    height: 46,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  segmentContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minWidth: 0,
  },
  segmentContentIconOnly: {
    gap: 0,
  },
  segmentActive: {
    backgroundColor: colors.white,
  },
  segmentPressed: {
    opacity: 0.82,
  },
  segmentDisabled: {
    opacity: 0.42,
  },
  segmentText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: colors.background,
  },
  segmentTextDisabled: {
    color: colors.textMuted,
  },
});
