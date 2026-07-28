import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  next: 'play-skip-forward',
  previous: 'play-skip-back',
  seekBack: 'play-back',
  seekForward: 'play-forward',
  slideshow: 'easel-outline',
  exit: 'exit-outline',
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
  next: 'Next',
  previous: 'Prev',
  seekBack: '-10s',
  seekForward: '+10s',
  slideshow: 'Slide show',
  exit: 'Exit',
});

const DIRECTION_ACTIONS = Object.freeze(['up', 'left', 'center', 'right', 'down']);
const MEDIA_ACTIONS = Object.freeze(['previous', 'playPause', 'next', 'seekBack', 'seekForward', 'fullscreen']);
const PRESENTATION_ACTIONS = Object.freeze(['slideshow', 'previous', 'next', 'exit']);
const SOCIAL_ACTIONS = Object.freeze(['left', 'center', 'right', 'back']);
const GENERIC_ACTIONS = Object.freeze(['back', 'center', 'fullscreen']);

const APP_ACTION_GROUPS = Object.freeze({
  youtube: MEDIA_ACTIONS,
  spotify: Object.freeze(['previous', 'playPause', 'next']),
  powerpoint: PRESENTATION_ACTIONS,
  instagram: SOCIAL_ACTIONS,
  media: MEDIA_ACTIONS,
  presentation: PRESENTATION_ACTIONS,
  social: SOCIAL_ACTIONS,
  default: GENERIC_ACTIONS,
});

const TARGET_ICONS = Object.freeze({
  youtube: 'logo-youtube',
  powerpoint: 'easel-outline',
  instagram: 'logo-instagram',
  spotify: 'musical-notes-outline',
});

const TARGET_ACTIONS = Object.freeze({
  youtube: new Set([...DIRECTION_ACTIONS, ...MEDIA_ACTIONS, 'back']),
  powerpoint: new Set([...DIRECTION_ACTIONS, ...PRESENTATION_ACTIONS, 'playPause', 'fullscreen', 'back']),
  instagram: new Set([...DIRECTION_ACTIONS, ...SOCIAL_ACTIONS]),
  spotify: new Set([...DIRECTION_ACTIONS, 'previous', 'playPause', 'next', 'back']),
  media: new Set([...DIRECTION_ACTIONS, ...MEDIA_ACTIONS, 'back']),
  presentation: new Set([...DIRECTION_ACTIONS, ...PRESENTATION_ACTIONS, 'playPause', 'fullscreen', 'back']),
  social: new Set([...DIRECTION_ACTIONS, ...SOCIAL_ACTIONS]),
  default: new Set([...DIRECTION_ACTIONS, ...GENERIC_ACTIONS]),
});

function targetKey(target) {
  return `${target?.id || ''}:${target?.tabTitle || target?.windowTitle || target?.processName || ''}`;
}

function normalizeRemoteTarget(target) {
  if (!target || typeof target !== 'object') return null;
  const key = targetKey(target);
  if (!key.replace(':', '').trim()) return null;
  return {
    ...target,
    id: String(target.id || target.processName || 'remote').trim(),
    label: String(target.label || target.tabTitle || target.windowTitle || target.processName || 'Remote app').trim(),
  };
}

function targetIconName(target) {
  const id = String(target?.id || '').toLowerCase();
  if (TARGET_ICONS[id]) return TARGET_ICONS[id];
  if (target?.kind === 'presentation') return 'easel-outline';
  if (target?.kind === 'media') return 'play-circle-outline';
  return 'tv-outline';
}

function targetProfile(target) {
  const id = String(target?.id || '').toLowerCase();
  if (APP_ACTION_GROUPS[id]) return id;
  const kind = String(target?.kind || '').toLowerCase();
  if (APP_ACTION_GROUPS[kind]) return kind;
  return 'default';
}

function remoteActionsForTarget(target) {
  return APP_ACTION_GROUPS[targetProfile(target)] || APP_ACTION_GROUPS.default;
}

function isActionSupported(target, action) {
  const profile = targetProfile(target);
  return !TARGET_ACTIONS[profile] || TARGET_ACTIONS[profile].has(action);
}

function statusTone({ connected, hasTargets, busy }) {
  if (busy) return 'info';
  if (!connected || !hasTargets) return 'warning';
  return 'ready';
}

function friendlyRemoteStatus({ connected, busy, selectedTarget, remoteControlStatus }) {
  if (!connected) return 'Connect to OpenX Desktop to use this remote.';
  if (busy) return 'Finding active apps on your desktop...';
  const explicit = String(remoteControlStatus || '').trim();
  if (explicit) return explicit;
  if (!selectedTarget) return 'Open a supported desktop app, then scan.';
  return `${selectedTarget.label || 'App'} is ready.`;
}

function isRoutineReadyStatus(value) {
  return /^\d+\s+active\s+remote\s+apps?\s+found\.$/i.test(String(value || '').trim());
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

function RemoteActionPill({ action, disabled, onPress, unsupported }) {
  return (
    <Pressable
      accessibilityLabel={`Remote ${ACTION_LABELS[action] || action}${unsupported ? ' unavailable for this app' : ''}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress?.(action)}
      style={({ pressed }) => [
        styles.actionPill,
        unsupported && styles.actionPillUnsupported,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons
        color={unsupported ? colors.textMuted : colors.text}
        name={unsupported ? 'remove-circle-outline' : CONTROL_ICONS[action] || 'ellipse'}
        size={19}
      />
      <Text
        numberOfLines={1}
        style={[styles.actionPillText, unsupported && styles.actionPillTextUnsupported]}
      >
        {ACTION_LABELS[action] || action}
      </Text>
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
  const safeRemoteTargets = useMemo(() => (
    (Array.isArray(remoteTargets) ? remoteTargets : [])
      .map(normalizeRemoteTarget)
      .filter(Boolean)
  ), [remoteTargets]);

  const selectedTarget = useMemo(() => (
    safeRemoteTargets.find((target) => targetKey(target) === selectedKey) || safeRemoteTargets[0] || null
  ), [safeRemoteTargets, selectedKey]);

  useEffect(() => {
    if (!safeRemoteTargets.length) {
      setSelectedKey('');
      return;
    }
    if (!safeRemoteTargets.some((target) => targetKey(target) === selectedKey)) {
      setSelectedKey(targetKey(safeRemoteTargets[0]));
    }
  }, [safeRemoteTargets, selectedKey]);

  useEffect(() => {
    if (!connected || safeRemoteTargets.length || remoteControlBusy) return;
    refreshRemoteTargets?.();
  }, [connected, refreshRemoteTargets, remoteControlBusy, safeRemoteTargets.length]);

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

  const isControlDisabled = useCallback((action) => (
    !connected || !selectedTarget || remoteControlBusy || !isActionSupported(selectedTarget, action)
  ), [connected, remoteControlBusy, selectedTarget]);
  const quickActions = useMemo(() => remoteActionsForTarget(selectedTarget), [selectedTarget]);
  const activeTitle = selectedTarget?.tabTitle || selectedTarget?.windowTitle || selectedTarget?.label || 'No active app';
  const tone = statusTone({ connected, hasTargets: safeRemoteTargets.length > 0, busy: remoteControlBusy });
  const statusIcon = tone === 'ready' ? 'checkmark-circle' : tone === 'info' ? 'sync-outline' : 'alert-circle-outline';
  const statusMessage = friendlyRemoteStatus({ connected, busy: remoteControlBusy, selectedTarget, remoteControlStatus });
  const explicitStatus = String(remoteControlStatus || '').trim();
  const showStatus = tone !== 'ready' || (Boolean(explicitStatus) && !isRoutineReadyStatus(explicitStatus));

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding, paddingTop: topPadding }]}>
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
          {remoteControlBusy ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Ionicons color={colors.text} name="refresh" size={21} />
          )}
        </Pressable>
      </View>

      <LinearGradient colors={gradients.glassSoft} style={styles.targetPanel}>
        <View style={styles.targetPanelHeader}>
          <View style={styles.targetPanelCopy}>
            <Text style={styles.sectionLabel}>Active app</Text>
          </View>
          <Text style={styles.targetCount}>{safeRemoteTargets.length}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.targetRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {safeRemoteTargets.length ? safeRemoteTargets.map((target) => {
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
                  name={targetIconName(target)}
                  size={19}
                />
                <View style={styles.targetChipCopy}>
                  <Text
                    numberOfLines={1}
                    style={[styles.targetChipText, selected && styles.targetChipTextActive]}
                  >
                    {target.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.targetChipMeta, selected && styles.targetChipMetaActive]}
                  >
                    {target.kind || target.processName || 'remote'}
                  </Text>
                </View>
              </Pressable>
            );
          }) : (
            <Pressable
              accessibilityLabel="Scan active desktop apps"
              accessibilityRole="button"
              disabled={!connected || remoteControlBusy}
              onPress={handleRefresh}
              style={({ pressed }) => [
                styles.emptyChip,
                pressed && styles.pressed,
                (!connected || remoteControlBusy) && styles.disabled,
              ]}
            >
              <Ionicons color={colors.textSecondary} name="tv-outline" size={18} />
              <Text style={styles.emptyChipText}>{connected ? 'Scan active apps' : 'Desktop not connected'}</Text>
            </Pressable>
          )}
        </ScrollView>
      </LinearGradient>

      <View style={styles.stage}>
        <LinearGradient
          colors={gradients.glassSoft}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.remoteDisc}
        >
          <RemotePadButton
            action="up"
            disabled={isControlDisabled('up')}
            onPress={handleRemoteAction}
            style={styles.padUp}
          />
          <RemotePadButton
            action="left"
            disabled={isControlDisabled('left')}
            onPress={handleRemoteAction}
            style={styles.padLeft}
          />
          <RemotePadButton
            action="center"
            disabled={isControlDisabled('center')}
            onPress={handleRemoteAction}
            size={66}
            style={styles.padCenter}
          />
          <RemotePadButton
            action="right"
            disabled={isControlDisabled('right')}
            onPress={handleRemoteAction}
            style={styles.padRight}
          />
          <RemotePadButton
            action="down"
            disabled={isControlDisabled('down')}
            onPress={handleRemoteAction}
            style={styles.padDown}
          />
        </LinearGradient>
      </View>

      <View style={styles.actionGrid}>
        {quickActions.map((action) => {
          const unsupported = selectedTarget ? !isActionSupported(selectedTarget, action) : false;
          return (
            <RemoteActionPill
              action={action}
              disabled={isControlDisabled(action)}
              key={action}
              onPress={handleRemoteAction}
              unsupported={unsupported}
            />
          );
        })}
      </View>

      {showStatus ? (
        <View style={[styles.statusCard, styles[`status_${tone}`]]}>
          <Ionicons
            color={tone === 'ready' ? colors.success : tone === 'info' ? colors.textSecondary : colors.warning}
            name={statusIcon}
            size={17}
          />
          <Text numberOfLines={2} style={styles.status}>
            {statusMessage}
          </Text>
        </View>
      ) : null}
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
    marginBottom: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 25,
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
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  targetRow: {
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingTop: spacing.xs,
  },
  targetPanel: {
    ...shadows.card,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  targetPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  targetPanelCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  targetCount: {
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 32,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
  targetChip: {
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 48,
    maxWidth: 174,
    minWidth: 122,
    paddingHorizontal: spacing.sm,
  },
  targetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  targetChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  targetChipCopy: {
    flex: 1,
    minWidth: 0,
  },
  targetChipMeta: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 1,
    textTransform: 'uppercase',
  },
  targetChipTextActive: {
    color: colors.background,
  },
  targetChipMetaActive: {
    color: 'rgba(3, 5, 10, 0.62)',
  },
  emptyChip: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 48,
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
    minHeight: 214,
    paddingVertical: spacing.md,
  },
  remoteDisc: {
    ...shadows.floating,
    borderColor: colors.borderBright,
    borderRadius: 112,
    borderWidth: 1,
    height: 216,
    position: 'relative',
    width: 216,
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
    left: 80,
    top: 14,
  },
  padDown: {
    bottom: 14,
    left: 80,
  },
  padLeft: {
    left: 14,
    top: 80,
  },
  padRight: {
    right: 14,
    top: 80,
  },
  padCenter: {
    backgroundColor: colors.primary,
    left: 75,
    top: 75,
  },
  centerLabel: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '900',
    marginTop: -2,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionPill: {
    alignItems: 'center',
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderBright,
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 46,
    justifyContent: 'center',
    minWidth: 96,
    paddingHorizontal: spacing.sm,
  },
  actionPillUnsupported: {
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
  },
  actionPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  actionPillTextUnsupported: {
    color: colors.textMuted,
  },
  status: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    lineHeight: 18,
  },
  statusCard: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  status_ready: {
    backgroundColor: 'rgba(70, 217, 145, 0.12)',
    borderColor: 'rgba(70, 217, 145, 0.22)',
  },
  status_info: {
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
  },
  status_warning: {
    backgroundColor: 'rgba(246, 185, 74, 0.12)',
    borderColor: 'rgba(246, 185, 74, 0.22)',
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.42,
  },
});
