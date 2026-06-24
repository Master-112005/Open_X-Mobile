import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../styles/theme';

export default function MessageInput({
  disabled = false,
  disabledMessage = 'Pair this device before sending commands.',
  onSend,
}) {
  const [value, setValue] = useState('');
  const canSend = !disabled && value.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    if (onSend(value)) setValue('');
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputShell}>
        <TextInput
          accessibilityLabel="Message OpenX"
          blurOnSubmit={false}
          editable={!disabled}
          maxLength={1000}
          multiline
          onChangeText={setValue}
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
          <Text style={styles.sendIcon}>↑</Text>
        </Pressable>
      </View>
      <Text style={[styles.helper, disabled && styles.restrictedHelper]}>
        {disabled
          ? disabledMessage
          : 'Commands are sent to the connected OpenX Desktop'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === 'android' ? spacing.md : spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  inputShell: {
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    padding: 6,
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
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sendButtonDisabled: { backgroundColor: '#2C3546' },
  sendButtonPressed: { backgroundColor: colors.primaryPressed },
  sendIcon: {
    color: colors.white,
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 25,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  restrictedHelper: { color: '#F6B94A' },
});
