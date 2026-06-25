import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { colors, radius, shadows, spacing } from '../styles/theme';

export default function MessageInput({
  disabled = false,
  disabledMessage = 'Pair this device before sending commands.',
  onSend,
}) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const canSend = !disabled && value.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    if (onSend(value)) setValue('');
  };

  return (
    <LinearGradient
      colors={['rgba(6,8,20,0.35)', 'rgba(6,8,20,0.99)']}
      style={styles.wrapper}
    >
      <LinearGradient
        colors={[colors.surfaceElevated, colors.surfaceSoft]}
        style={[styles.inputShell, focused && styles.inputShellFocused]}
      >
        <TextInput
          accessibilityLabel="Message OpenX"
          blurOnSubmit={false}
          editable={!disabled}
          maxLength={1000}
          multiline
          onBlur={() => setFocused(false)}
          onChangeText={setValue}
          onFocus={() => setFocused(true)}
          onSubmitEditing={handleSend}
          placeholder={disabled ? 'Command unavailable' : 'Send a command...'}
          placeholderTextColor={colors.textMuted}
          returnKeyType="send"
          style={styles.input}
          submitBehavior="submit"
          value={value}
        />
        <Pressable
          accessibilityLabel="Send message"
          accessibilityRole="button"
          disabled={!canSend}
          hitSlop={8}
          onPress={handleSend}
          style={({ pressed }) => [
            styles.sendButton,
            !canSend && styles.sendButtonDisabled,
            pressed && canSend && styles.sendButtonPressed,
          ]}
        >
          <LinearGradient
            colors={canSend ? [colors.primary, '#5269D9'] : ['#303A50', '#273044']}
            style={styles.sendGradient}
          >
            <Text style={styles.sendIcon}>{'\u2191'}</Text>
          </LinearGradient>
        </Pressable>
      </LinearGradient>
      <Text style={[styles.helper, disabled && styles.restrictedHelper]}>
        {disabled
          ? disabledMessage
          : 'Commands are sent to the connected OpenX Desktop'}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === 'android' ? spacing.md : spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  inputShell: {
    ...shadows.card,
    alignItems: 'flex-end',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    padding: 6,
  },
  inputShellFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    textAlignVertical: 'top',
  },
  sendButton: {
    borderRadius: radius.md,
    height: 40,
    overflow: 'hidden',
    width: 40,
  },
  sendButtonDisabled: { opacity: 0.72 },
  sendButtonPressed: { opacity: 0.78, transform: [{ scale: 0.94 }] },
  sendGradient: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  sendIcon: {
    color: colors.white,
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 25,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  restrictedHelper: { color: colors.warning },
});
