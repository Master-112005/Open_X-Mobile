import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import GlassPanel from './GlassPanel';
import { colors, radius, spacing } from '../styles/theme';

const TONES = {
  info: { color: colors.text, icon: 'information-circle-outline' },
  success: { color: colors.success, icon: 'checkmark-circle-outline' },
  warning: { color: colors.warning, icon: 'warning-outline' },
  error: { color: colors.danger, icon: 'alert-circle-outline' },
};

export default function OpenXNotice({ notice, onDismiss }) {
  if (!notice) return null;
  const tone = TONES[notice.tone] || TONES.info;
  const actions = Array.isArray(notice.actions) && notice.actions.length
    ? notice.actions
    : [{ label: 'OK' }];

  const runAction = (action) => {
    onDismiss?.();
    action?.onPress?.();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={notice.dismissible === false ? undefined : onDismiss}
      transparent
      visible
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Dismiss notice"
          disabled={notice.dismissible === false}
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <GlassPanel style={styles.panel} contentStyle={styles.content}>
          <View style={[styles.icon, { borderColor: tone.color }]}>
            <Ionicons color={tone.color} name={notice.icon || tone.icon} size={27} />
          </View>
          <Text style={styles.title}>{notice.title || 'OpenX'}</Text>
          <Text style={styles.message}>{notice.message || ''}</Text>
          <View style={styles.actions}>
            {actions.map((action, index) => (
              <Pressable
                accessibilityRole="button"
                key={`${action.label || 'action'}-${index}`}
                onPress={() => runAction(action)}
                style={({ pressed }) => [
                  styles.button,
                  action.tone === 'primary' && styles.primaryButton,
                  action.tone === 'danger' && styles.dangerButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.buttonText}>{action.label || 'OK'}</Text>
              </Pressable>
            ))}
          </View>
        </GlassPanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: { maxWidth: 420, width: '100%' },
  content: { alignItems: 'center', padding: spacing.xl },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.xl,
    width: '100%',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  primaryButton: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: colors.borderBright },
  dangerButton: { backgroundColor: 'rgba(255,102,117,0.16)', borderColor: 'rgba(255,102,117,0.5)' },
  buttonText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
