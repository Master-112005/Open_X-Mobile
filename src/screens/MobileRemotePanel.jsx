import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, gradients, radius, shadows, spacing } from '../styles/theme';

const CONTROL_ICONS = Object.freeze({
  up: 'chevron-up',
  down: 'chevron-down',
  left: 'chevron-back',
  right: 'chevron-forward',
  center: 'ellipse',
  back: 'arrow-undo-outline',
  playPause: 'play',
  fullscreen: 'expand-outline',
});

const ACTION_LABELS = Object.freeze({
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  center: 'OK',
  back: 'Back',
  playPause: 'Play',
  fullscreen: 'Full',
});

function targetKey(target) {
  return `${target?.id || ''}:${target?.tabTitle || target?.windowTitle || target?.processName || ''}`;
}

function RemotePadButton({ action, disabled, onPress, style, size = 58 }) {
  return (
    <Pressable
      accessibilityLabel={`Remote ${ACTION_LABELS[action] || action}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress?.(action)}
      style={({ pressed }) => [
        styles.padButton,
        { height: size, width: size },
        style,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons
        color={action === 'center' ? colors.background : colors.text}
        name={CONTROL_ICONS[action] || 'ellipse'}
        size={action === 'center' ? 26 : 32}
      />
      {action === 'center' ? <Text style={styles.centerLabel}>OK</Text> : null}
    </Pressable>
  );
}

function RemoteActionPill({ action, disabled, onPress }) {
  return (
    <Pressable
      accessibilityLabel={`Remote ${ACTION_LABELS[action] || action}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress?.(action)}
      style={({ pressed }) => [
        styles.actionPill,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons color={colors.text} name={CONTROL_ICONS[action] || 'ellipse'} size={18} />
      <Text style={styles.actionPillText}>{ACTION_LABELS[action] || action}</Text>
    </Pressable>
  );
}

export default function MobileRemotePanel({
  bottomPadding = 120,
  topPadding = 120,
  paired,
  cloudStatus,
  remoteTargets = [],
  remoteControlStatus = '',
  remoteControlBusy = false,
  refreshRemoteTargets,
  sendRemoteControl,
  showNotice,
}) {
  const [selectedKey, setSelectedKey] = useState('');
  const connected = paired && cloudStatus?.connected;

  const selectedTarget = useMemo(() => (
    remoteTargets.find((target) => targetKey(target) === selectedKey) || remoteTargets[0] || null
  ), [remoteTargets, selectedKey]);

  useEffect(() => {
    if (!remoteTargets.length) {
      setSelectedKey('');
      return;
    }
    if (!remoteTargets.some((target) => targetKey(target) === selectedKey)) {
      setSelectedKey(targetKey(remoteTargets[0]));
    }
  }, [remoteTargets, selectedKey]);

  useEffect(() => {
    if (!connected || remoteTargets.length || remoteControlBusy) return;
    refreshRemoteTargets?.();
  }, [connected, refreshRemoteTargets, remoteControlBusy, remoteTargets.length]);

  const handleRefresh = useCallback(() => {
    if (!connected) {
      showNotice?.({
        title: 'Remote unavailable',
        message: 'Connect this phone to OpenX Desktop first.',
        tone: 'warning',
      });
      return;
    }
    refreshRemoteTargets?.();
  }, [connected, refreshRemoteTargets, showNotice]);

  const handleRemoteAction = useCallback((action) => {
    if (!connected) {
      showNotice?.({
        title: 'Remote unavailable',
        message: 'Connect this phone to OpenX Desktop first.',
        tone: 'warning',
      });
      return;
    }
    if (!selectedTarget) {
      showNotice?.({
        title: 'No app selected',
        message: 'Open YouTube, PowerPoint, Instagram, or Spotify on Desktop.',
        tone: 'warning',
      });
      return;
    }
    sendRemoteControl?.({
      targetId: selectedTarget.id,
      action,
      windowTitle: selectedTarget.windowTitle,
      tabTitle: selectedTarget.tabTitle,
      targetHandle: selectedTarget.handle,
      targetProcessId: selectedTarget.processId,
      processName: selectedTarget.processName,
    });
  }, [connected, selectedTarget, sendRemoteControl, showNotice]);

  const disabled = !connected || !selectedTarget || remoteControlBusy;
  const activeTitle = selectedTarget?.tabTitle || selectedTarget?.windowTitle || selectedTarget?.label || 'No active app';

  return (
    <View style={[styles.container, { paddingBottom, paddingTop }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Remote</Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {connected ? activeTitle : 'Connect to OpenX Desktop'}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Refresh remote apps"
          accessibilityRole="button"
          disabled={remoteControlBusy}
          onPress={handleRefresh}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.pressed,
            remoteControlBusy && styles.disabled,
          ]}
        >
          <Ionicons color={colors.text} name="refresh" size={21} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.targetRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {remoteTargets.length ? remoteTargets.map((target) => {
          const key = targetKey(target);
          const selected = selectedTarget && key === targetKey(selectedTarget);
          return (
            <Pressable
              accessibilityLabel={`Select ${target.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={key}
              onPress={() => setSelectedKey(key)}
              style={({ pressed }) => [
                styles.targetChip,
                selected && styles.targetChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                color={selected ? colors.background : colors.text}
                name={target.id === 'powerpoint' ? 'easel-outline' : target.id === 'youtube' ? 'logo-youtube' : 'tv-outline'}
                size={17}
              />
              <Text numberOfLines={1} style={[styles.targetChipText, selected && styles.targetChipTextActive]}>
                {target.label}
              </Text>
            </Pressable>
          );
        }) : (
          <View style={styles.emptyChip}>
            <Ionicons color={colors.textSecondary} name="tv-outline" size={18} />
            <Text style={styles.emptyChipText}>No active remote apps</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.stage}>
        <LinearGradient
          colors={gradients.glassSoft}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.remoteDisc}
        >
          <RemotePadButton action="up" disabled={disabled} onPress={handleRemoteAction} style={styles.padUp} />
          <RemotePadButton action="left" disabled={disabled} onPress={handleRemoteAction} style={styles.padLeft} />
          <RemotePadButton action="center" disabled={disabled} onPress={handleRemoteAction} size={68} style={styles.padCenter} />
          <RemotePadButton action="right" disabled={disabled} onPress={handleRemoteAction} style={styles.padRight} />
          <RemotePadButton action="down" disabled={disabled} onPress={handleRemoteAction} style={styles.padDown} />
        </LinearGradient>
      </View>

      <View style={styles.actions}>
        <RemoteActionPill action="back" disabled={disabled} onPress={handleRemoteAction} />
        <RemoteActionPill action="playPause" disabled={disabled} onPress={handleRemoteAction} />
        <RemoteActionPill action="fullscreen" disabled={disabled} onPress={handleRemoteAction} />
      </View>

      <Text numberOfLines={2} style={styles.status}>
        {remoteControlStatus || 'Only active desktop apps appear here.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  refreshButton: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderBright,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  targetRow: {
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingBottom: spacing.lg,
  },
  targetChip: {
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 38,
    maxWidth: 168,
    paddingHorizontal: spacing.md,
  },
  targetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  targetChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    maxWidth: 112,
  },
  targetChipTextActive: {
    color: colors.background,
  },
  emptyChip: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 38,
    paddingHorizontal: spacing.md,
  },
  emptyChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  stage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 260,
  },
  remoteDisc: {
    ...shadows.floating,
    borderColor: colors.borderBright,
    borderRadius: 128,
    borderWidth: 1,
    height: 244,
    position: 'relative',
    width: 244,
  },
  padButton: {
    alignItems: 'center',
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderBright,
    borderRadius: radius.round,
    borderWidth: 1,
    justifyContent: 'center',
    position: 'absolute',
  },
  padUp: {
    left: 93,
    top: 18,
  },
  padDown: {
    bottom: 18,
    left: 93,
  },
  padLeft: {
    left: 18,
    top: 93,
  },
  padRight: {
    right: 18,
    top: 93,
  },
  padCenter: {
    backgroundColor: colors.primary,
    left: 88,
    top: 88,
  },
  centerLabel: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '900',
    marginTop: -2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  actionPill: {
    alignItems: 'center',
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderBright,
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 42,
    justifyContent: 'center',
    minWidth: 90,
    paddingHorizontal: spacing.md,
  },
  actionPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  status: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    minHeight: 38,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.42,
  },
});
