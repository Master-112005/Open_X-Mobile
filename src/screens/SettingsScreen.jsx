import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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

import GlassButton from '../components/GlassButton';
import GlassPanel from '../components/GlassPanel';
import SegmentedSlider from '../components/SegmentedSlider';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../styles/theme';

const PERMISSION_ITEMS = [
  { key: 'remoteCommands', label: 'Desktop commands' },
  { key: 'fileTransfer', label: 'File transfer' },
  { key: 'receiveFiles', label: 'Receive files' },
  { key: 'sendFiles', label: 'Send files' },
];

const SETTINGS_TABS = [
  { label: 'System', value: 'system' },
  { label: 'Profile', value: 'profile' },
  { label: 'Mobile', value: 'mobile' },
  { label: 'Modes', value: 'modes' },
];

function HeaderButton({ accessibilityLabel, iconName, onPress }) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      <Ionicons color={colors.text} name={iconName} size={22} />
    </Pressable>
  );
}

export default function SettingsScreen({ navigation }) {
  const {
    cloudStatus,
    deviceName,
    permissions,
    permissionsLastUpdated,
    permissionsLoaded,
    updateDeviceName,
    showNotice,
  } = useApp();
  const [phoneName, setPhoneName] = useState(deviceName);
  const [savingName, setSavingName] = useState(false);
  const [settingsTab, setSettingsTab] = useState('system');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setPhoneName(deviceName);
  }, [deviceName]);

  const handleSaveDeviceName = async () => {
    const normalizedName = phoneName.replace(/\s+/g, ' ').trim();
    if (!normalizedName) {
      showNotice({ title: 'Mobile name required', message: 'Enter a name for this mobile.', tone: 'warning' });
      return;
    }
    setSavingName(true);
    try {
      await updateDeviceName(normalizedName);
      showNotice({ title: 'Saved', message: 'This mobile name was saved.', tone: 'success' });
    } catch (error) {
      showNotice({ title: 'Unable to save', message: error.message || 'Please try again.', tone: 'error' });
    } finally {
      setSavingName(false);
    }
  };

  const activeStatusText = cloudStatus?.state || 'disconnected';
  const activeConnected = cloudStatus?.connected === true;

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <HeaderButton
            accessibilityLabel="Go back"
            iconName="chevron-back"
            onPress={() => navigation.goBack()}
          />
          <HeaderButton
            accessibilityLabel="Open QR scanner"
            iconName="qr-code-outline"
            onPress={() => navigation.navigate('QRPairing')}
          />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 84, paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Manage pairing and connection behavior.</Text>
          </View>

          <SegmentedSlider
            accessibilityLabel="Settings sections"
            onChange={setSettingsTab}
            options={SETTINGS_TABS}
            segmentStyle={styles.settingsSegment}
            style={styles.settingsSlider}
            textStyle={styles.settingsSegmentText}
            value={settingsTab}
          />

          {settingsTab === 'system' ? (
            <>
              <GlassPanel style={styles.summaryCard} contentStyle={styles.summaryContent}>
                <View style={styles.summaryMain}>
                  <View style={styles.summaryIcon}>
                    <Ionicons color={colors.text} name="phone-portrait-outline" size={22} />
                  </View>
                  <View style={styles.summaryText}>
                    <Text numberOfLines={1} style={styles.summaryName}>{phoneName || deviceName}</Text>
                    <Text style={styles.summaryMeta}>Cloud relay</Text>
                  </View>
                </View>
                <View style={[styles.summaryStatus, activeConnected ? styles.summaryStatusOn : styles.summaryStatusOff]}>
                  <View style={[styles.summaryDot, activeConnected ? styles.summaryDotOn : styles.summaryDotOff]} />
                  <Text style={styles.summaryStatusText}>{activeStatusText || 'offline'}</Text>
                </View>
              </GlassPanel>

              <Text style={styles.sectionTitle}>Desktop permissions</Text>
              <GlassPanel style={styles.card} contentStyle={styles.cardContent}>
                {permissionsLoaded ? (
                  <View style={styles.permissionList}>
                    {PERMISSION_ITEMS.map((item) => {
                      const allowed = permissions[item.key];
                      return (
                        <View key={item.key} style={styles.permissionRow}>
                          <Text style={styles.permissionLabel}>{item.label}</Text>
                          <View style={[styles.permissionDot, allowed ? styles.allowed : styles.denied]} />
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <ActivityIndicator color={colors.text} style={styles.loader} />
                )}
                <Text style={styles.updatedText}>
                  {permissionsLastUpdated
                    ? `Updated ${new Date(permissionsLastUpdated).toLocaleString()}`
                    : 'Waiting for desktop permission state'}
                </Text>
              </GlassPanel>
            </>
          ) : null}

          {settingsTab === 'mobile' ? (
            <>
              <Text style={styles.sectionTitle}>Mobile name</Text>
              <GlassPanel style={styles.card} contentStyle={styles.cardContent}>
                <Text style={styles.label}>Mobile name</Text>
                <TextInput
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={100}
                  onChangeText={setPhoneName}
                  placeholder="My Mobile"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  style={styles.input}
                  value={phoneName}
                />
                <GlassButton
                  disabled={savingName || phoneName.trim().length === 0}
                  iconName="phone-portrait-outline"
                  label="Save Name"
                  loading={savingName}
                  onPress={handleSaveDeviceName}
                  style={styles.nameButton}
                />
              </GlassPanel>
            </>
          ) : null}

          {settingsTab === 'profile' ? (
            <GlassPanel style={styles.summaryCard} contentStyle={styles.cardContent}>
              <View style={styles.profilePrompt}>
                <View style={styles.summaryIcon}>
                  <Ionicons color={colors.text} name="person-circle-outline" size={22} />
                </View>
                <View style={styles.summaryText}>
                  <Text style={styles.summaryName}>Profile</Text>
                  <Text style={styles.summaryMeta}>Manage local identity fields.</Text>
                </View>
              </View>
              <GlassButton
                iconName="person-circle-outline"
                label="Open Profile"
                onPress={() => navigation.navigate('Profile')}
                style={styles.nameButton}
              />
            </GlassPanel>
          ) : null}

          {settingsTab === 'modes' ? (
            <GlassPanel style={styles.card} contentStyle={styles.cardContent}>
              <Text style={styles.advancedText}>
                OpenX Mobile uses cloud pairing and the secure relay for commands, schedules, and file transfers.
              </Text>
            </GlassPanel>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  titleBlock: {
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  settingsSlider: {
    marginBottom: spacing.lg,
    minHeight: 52,
  },
  settingsSegment: {
    height: 44,
    paddingHorizontal: spacing.xs,
  },
  settingsSegmentText: {
    fontSize: 12,
  },
  summaryCard: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  summaryContent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  summaryMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minWidth: 0,
  },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
  },
  profilePrompt: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  summaryMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  summaryStatus: {
    alignItems: 'center',
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: 126,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  summaryStatusOn: {
    backgroundColor: 'rgba(70, 217, 145, 0.12)',
    borderColor: 'rgba(70, 217, 145, 0.34)',
  },
  summaryStatusOff: {
    backgroundColor: 'rgba(255, 83, 83, 0.10)',
    borderColor: 'rgba(255, 83, 83, 0.30)',
  },
  summaryDot: {
    borderRadius: radius.round,
    height: 8,
    width: 8,
  },
  summaryDotOn: {
    backgroundColor: colors.success,
  },
  summaryDotOff: {
    backgroundColor: colors.danger,
  },
  summaryStatusText: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  card: {
    borderRadius: radius.lg,
  },
  cardContent: {
    padding: spacing.lg,
  },
  permissionList: {
    gap: spacing.md,
  },
  permissionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  permissionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  permissionDot: {
    borderRadius: radius.round,
    height: 10,
    width: 10,
  },
  allowed: { backgroundColor: colors.success },
  denied: { backgroundColor: colors.danger },
  updatedText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.lg,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  fieldGap: {
    marginTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    height: 54,
    paddingHorizontal: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  buttonFlex: { flex: 1 },
  nameButton: {
    marginTop: spacing.lg,
  },
  advancedText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
