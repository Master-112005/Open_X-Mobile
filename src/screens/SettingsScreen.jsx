import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassPanel from '../components/GlassPanel';
import MobileBottomDock, { getMobileBottomDockHeight } from '../components/MobileBottomDock';
import ScreenBackground from '../components/ScreenBackground';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../styles/theme';

const PERMISSION_ITEMS = [
  { key: 'remoteCommands', label: 'Commands', iconName: 'terminal-outline' },
  { key: 'fileTransfer', label: 'File transfer', iconName: 'swap-horizontal-outline' },
  { key: 'receiveFiles', label: 'Receive files', iconName: 'download-outline' },
  { key: 'sendFiles', label: 'Send files', iconName: 'share-outline' },
];

function sectionDivider(index) {
  return index > 0 ? <View style={styles.divider} /> : null;
}

function Section({ children, title }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <GlassPanel style={styles.sectionPanel} contentStyle={styles.sectionContent}>
        {children}
      </GlassPanel>
    </View>
  );
}

function StatusPill({ connected = false, label }) {
  return (
    <View style={[styles.statusPill, connected ? styles.statusPillOn : styles.statusPillOff]}>
      <View style={[styles.statusDot, connected ? styles.statusDotOn : styles.statusDotOff]} />
      <Text numberOfLines={1} style={styles.statusText}>{label}</Text>
    </View>
  );
}

function SettingRow({
  connected,
  disabled = false,
  iconName,
  label,
  onPress,
  status,
}) {
  const content = (
    <>
      <View style={styles.rowIcon}>
        <Ionicons color={colors.text} name={iconName} size={20} />
      </View>
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowLabel}>{label}</Text>
        {status ? <Text numberOfLines={1} style={styles.rowStatus}>{status}</Text> : null}
      </View>
      {typeof connected === 'boolean' ? (
        <StatusPill connected={connected} label={connected ? 'On' : 'Off'} />
      ) : null}
      {onPress ? <Ionicons color={colors.textMuted} name="chevron-forward" size={18} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.settingRow,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.settingRow, disabled && styles.disabled]}>{content}</View>;
}

export default function SettingsScreen({ navigation }) {
  const {
    cloudStatus,
    connectionMode,
    connectionStatus,
    deviceName,
    openXProfile,
    paired,
    permissions,
    permissionsLoaded,
    scheduleItems,
    sessionValid,
    transferHistory,
    updateDeviceName,
    showNotice,
  } = useApp();
  const [phoneName, setPhoneName] = useState(deviceName);
  const [savingName, setSavingName] = useState(false);
  const insets = useSafeAreaInsets();
  const bottomDockHeight = getMobileBottomDockHeight(insets);
  const isCloud = connectionMode === 'cloud';
  const activeConnected = isCloud ? cloudStatus?.connected === true : connectionStatus === 'connected';
  const activeStatusText = isCloud ? cloudStatus?.state || 'disconnected' : connectionStatus || 'disconnected';
  const receivedCount = useMemo(
    () => transferHistory.filter((item) => item.direction === 'received').length,
    [transferHistory],
  );
  const scheduleCount = Array.isArray(scheduleItems) ? scheduleItems.length : 0;
  const profileReady = Boolean(
    String(openXProfile?.fullName || '').trim() ||
    String(openXProfile?.email || '').trim() ||
    String(openXProfile?.phone || '').trim(),
  );
  const allowedPermissionCount = PERMISSION_ITEMS.filter((item) => permissions?.[item.key]).length;

  useEffect(() => {
    setPhoneName(deviceName);
  }, [deviceName]);

  const handleSaveDeviceName = async () => {
    const normalizedName = phoneName.replace(/\s+/g, ' ').trim();
    if (!normalizedName) {
      showNotice({ title: 'Name required', message: 'Enter a mobile name.', tone: 'warning' });
      return;
    }
    setSavingName(true);
    try {
      await updateDeviceName(normalizedName);
      showNotice({ title: 'Saved', message: 'Mobile name updated.', tone: 'success' });
    } catch (error) {
      showNotice({ title: 'Unable to save', message: error.message || 'Please try again.', tone: 'error' });
    } finally {
      setSavingName(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + spacing.lg,
              paddingBottom: bottomDockHeight + spacing.xl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Settings</Text>

          <Section title="Profile">
            <SettingRow
              iconName="person-circle-outline"
              label="Profile"
              onPress={() => navigation.navigate('Profile')}
              status={profileReady ? 'Saved' : 'Not set'}
            />
          </Section>

          <Section title="System">
            <View style={styles.nameRow}>
              <View style={styles.rowIcon}>
                <Ionicons color={colors.text} name="phone-portrait-outline" size={20} />
              </View>
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={100}
                onChangeText={setPhoneName}
                placeholder="OpenX Mobile"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                style={styles.nameInput}
                value={phoneName}
              />
              <Pressable
                accessibilityLabel="Save mobile name"
                accessibilityRole="button"
                disabled={savingName || phoneName.trim().length === 0}
                onPress={handleSaveDeviceName}
                style={({ pressed }) => [
                  styles.saveNameButton,
                  pressed && styles.pressed,
                  (savingName || phoneName.trim().length === 0) && styles.disabled,
                ]}
              >
                {savingName ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Ionicons color={colors.background} name="checkmark" size={20} />
                )}
              </Pressable>
            </View>
            {sectionDivider(1)}
            <SettingRow
              connected={activeConnected}
              iconName="cloud-outline"
              label="Cloud relay"
              status={activeStatusText}
            />
            {sectionDivider(2)}
            <SettingRow
              iconName="qr-code-outline"
              label="Pair desktop"
              onPress={() => navigation.navigate('QRPairing')}
              status={paired ? 'Paired' : 'Not paired'}
            />
            {sectionDivider(3)}
            <SettingRow
              connected={sessionValid}
              iconName="shield-checkmark-outline"
              label="Session"
              status={sessionValid ? 'Active' : 'Reconnect'}
            />
            {sectionDivider(4)}
            <SettingRow
              iconName="calendar-outline"
              label="Calendar"
              onPress={() => navigation.navigate('Calendar')}
              status={`${scheduleCount} saved`}
            />
            {sectionDivider(5)}
            <SettingRow
              iconName="folder-open-outline"
              label="Files"
              onPress={() => navigation.navigate('Transfers')}
              status={`${receivedCount} received`}
            />
            {sectionDivider(6)}
            {permissionsLoaded ? (
              PERMISSION_ITEMS.map((item, index) => (
                <View key={item.key}>
                  {sectionDivider(index + 7)}
                  <SettingRow
                    connected={permissions?.[item.key] === true}
                    iconName={item.iconName}
                    label={item.label}
                    status={permissions?.[item.key] ? 'Allowed' : 'Blocked'}
                  />
                </View>
              ))
            ) : (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.text} />
                <Text style={styles.rowStatus}>Loading access</Text>
              </View>
            )}
            {permissionsLoaded ? (
              <Text style={styles.accessSummary}>{allowedPermissionCount}/{PERMISSION_ITEMS.length} allowed</Text>
            ) : null}
          </Section>
        </ScrollView>
        <MobileBottomDock
          activeRoute="Settings"
          navigation={navigation}
        />
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
    textTransform: 'uppercase',
  },
  sectionPanel: {
    borderRadius: radius.xl,
  },
  sectionContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 62,
    paddingVertical: spacing.sm,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 62,
    paddingVertical: spacing.sm,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  rowStatus: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
    textTransform: 'capitalize',
  },
  nameInput: {
    backgroundColor: colors.content,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    height: 46,
    minWidth: 0,
    paddingHorizontal: spacing.md,
  },
  saveNameButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.round,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  statusPill: {
    alignItems: 'center',
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
  },
  statusPillOn: {
    backgroundColor: 'rgba(70, 217, 145, 0.12)',
    borderColor: 'rgba(70, 217, 145, 0.34)',
  },
  statusPillOff: {
    backgroundColor: 'rgba(255, 102, 117, 0.10)',
    borderColor: 'rgba(255, 102, 117, 0.30)',
  },
  statusDot: {
    borderRadius: radius.round,
    height: 7,
    width: 7,
  },
  statusDotOn: {
    backgroundColor: colors.success,
  },
  statusDotOff: {
    backgroundColor: colors.danger,
  },
  statusText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 62,
  },
  accessSummary: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    paddingBottom: spacing.sm,
    paddingLeft: 54,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
