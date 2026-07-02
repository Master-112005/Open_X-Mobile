import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, gradients, radius, shadows, spacing } from '../styles/theme';

const toneGradients = {
  primary: gradients.primary,
  secondary: gradients.glass,
  quiet: gradients.glassSoft,
  danger: gradients.dangerSoft,
};

export default function GlassButton({
  accessibilityLabel,
  disabled = false,
  icon,
  iconName,
  label,
  loading = false,
  onPress,
  style,
  tone = 'secondary',
}) {
  const gradient = toneGradients[tone] || toneGradients.secondary;
  const primary = tone === 'primary';
  const resolvedIconName = iconName || icon;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        style,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={gradient}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.button, primary && styles.primaryButton]}
      >
        {loading ? (
          <ActivityIndicator color={primary ? colors.white : colors.primary} />
        ) : (
          <>
            {resolvedIconName ? (
              <View style={[styles.iconShell, primary && styles.primaryIconShell]}>
                <Ionicons
                  color={primary ? colors.white : colors.text}
                  name={resolvedIconName}
                  size={16}
                />
              </View>
            ) : null}
            <Text style={[styles.label, primary && styles.primaryLabel]}>
              {label}
            </Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.lg,
    minHeight: 52,
    overflow: 'hidden',
  },
  button: {
    ...shadows.card,
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  primaryButton: {
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.48,
  },
  iconShell: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 30,
  },
  primaryIconShell: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryLabel: {
    color: colors.white,
  },
});
