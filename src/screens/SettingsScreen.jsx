import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useApp } from '../context/AppContext';
import { normalizeRelayUrl } from '../services/relayClient';
import { colors, radius, spacing } from '../styles/theme';

const PERMISSION_ITEMS = [
  { key: 'remoteCommands', label: 'Desktop commands' },
  { key: 'fileTransfer', label: 'File transfer' },
  { key: 'receiveFiles', label: 'Receive files' },
  { key: 'sendFiles', label: 'Send files' },
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
    desktopAddress,
    desktopPort,
    connectionStatus,
    connectionMode,
    cloudStatus,
    cloudSettings,
    deviceName,
    permissions,
    permissionsLastUpdated,
    permissionsLoaded,
    saveSettings,
    setConnectionMode,
    saveCloudSettings,
    connectCloud,
    disconnectCloud,
    settingsLoaded,
    testConnection,
    updateDeviceName,
  } = useApp();
  const [address, setAddress] = useState(desktopAddress);
  const [port, setPort] = useState(desktopPort);
  const [phoneName, setPhoneName] = useState(deviceName);
  const [modeDraft, setModeDraft] = useState(connectionMode);
  const [relayUrl, setRelayUrl] = useState(normalizeRelayUrl(cloudSettings?.relayUrl));
  const [cloudAutoConnect, setCloudAutoConnect] = useState(cloudSettings?.autoConnect === true);
  const [cloudReconnect, setCloudReconnect] = useState(cloudSettings?.reconnectEnabled !== false);
  const [cloudHeartbeat, setCloudHeartbeat] = useState(cloudSettings?.heartbeatEnabled !== false);
  const [cloudTimeout, setCloudTimeout] = useState(String(cloudSettings?.connectionTimeoutMs || 10000));
  const [savingName, setSavingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (settingsLoaded) {
      setAddress(desktopAddress);
      setPort(desktopPort);
    }
  }, [desktopAddress, desktopPort, settingsLoaded]);

  useEffect(() => {
    setPhoneName(deviceName);
  }, [deviceName]);

  useEffect(() => {
    setModeDraft(connectionMode);
  }, [connectionMode]);

  useEffect(() => {
    setRelayUrl(normalizeRelayUrl(cloudSettings?.relayUrl));
    setCloudAutoConnect(cloudSettings?.autoConnect === true);
    setCloudReconnect(cloudSettings?.reconnectEnabled !== false);
    setCloudHeartbeat(cloudSettings?.heartbeatEnabled !== false);
    setCloudTimeout(String(cloudSettings?.connectionTimeoutMs || 10000));
  }, [cloudSettings]);

  const validatePort = () => /^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535;
  const validateCloudTimeout = () => /^\d+$/.test(cloudTimeout) &&
    Number(cloudTimeout) >= 1000 &&
    Number(cloudTimeout) <= 60000;

  const collectCloudSettings = () => ({
    relayUrl: normalizeRelayUrl(relayUrl),
    autoConnect: cloudAutoConnect,
    reconnectEnabled: cloudReconnect,
    heartbeatEnabled: cloudHeartbeat,
    connectionTimeoutMs: Number(cloudTimeout || 10000),
    heartbeatIntervalMs: cloudSettings?.heartbeatIntervalMs || 30000,
  });

  const handleSaveDeviceName = async () => {
    const normalizedName = phoneName.replace(/\s+/g, ' ').trim();
    if (!normalizedName) {
      Alert.alert('Phone name required', 'Enter a name for this phone.');
      return;
    }
    setSavingName(true);
    try {
      await updateDeviceName(normalizedName);
      Alert.alert('Saved', 'This phone name was saved.');
    } catch (error) {
      Alert.alert('Unable to save', error.message || 'Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const handleSave = async () => {
    if (!validatePort()) {
      Alert.alert('Invalid port', 'Enter a port number between 1 and 65535.');
      return;
    }
    setSaving(true);
    try {
      await saveSettings(address, port);
      Alert.alert('Saved', 'Manual fallback connection was saved.');
    } catch {
      Alert.alert('Unable to save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!address.trim()) {
      Alert.alert('Desktop address required', 'Enter the OpenX Desktop IP address.');
      return;
    }
    if (!validatePort()) {
      Alert.alert('Invalid port', 'Enter a port number between 1 and 65535.');
      return;
    }
    setTesting(true);
    try {
      await testConnection(address, port);
      Alert.alert('Connected', 'OpenX Desktop is reachable.');
    } catch {
      Alert.alert('Waiting', 'OpenX Desktop is not reachable yet.');
    } finally {
      setTesting(false);
    }
  };

  const handleModeChange = async (mode) => {
    setModeDraft(mode);
    try {
      await setConnectionMode(mode);
    } catch {
      Alert.alert('Unable to switch', 'Connection mode could not be changed.');
      setModeDraft(connectionMode);
    }
  };

  const handleSaveCloud = async () => {
    if (!relayUrl.trim()) {
      Alert.alert('Relay server required', 'Enter the relay server URL.');
      return;
    }
    if (!validateCloudTimeout()) {
      Alert.alert('Invalid timeout', 'Enter a timeout between 1000 and 60000 ms.');
      return;
    }
    setCloudBusy(true);
    try {
      await saveCloudSettings(collectCloudSettings());
      Alert.alert('Saved', 'Cloud connection settings were saved.');
    } catch {
      Alert.alert('Unable to save', 'Please check the relay URL and try again.');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleCloudToggle = async () => {
    if (!relayUrl.trim()) {
      Alert.alert('Relay server required', 'Enter the relay server URL.');
      return;
    }
    if (!validateCloudTimeout()) {
      Alert.alert('Invalid timeout', 'Enter a timeout between 1000 and 60000 ms.');
      return;
    }
    setCloudBusy(true);
    try {
      if (cloudStatus?.connected) {
        await disconnectCloud();
      } else {
        await connectCloud(collectCloudSettings());
      }
    } catch (error) {
      Alert.alert('Cloud connection', error.message || 'Unable to connect to the relay server.');
    } finally {
      setCloudBusy(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return '--';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '--'
      : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const formatDuration = (milliseconds) => {
    const totalSeconds = Math.floor(Math.max(0, Number(milliseconds) || 0) / 1000);
    if (totalSeconds <= 0) return '--';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const activeStatusText = modeDraft === 'cloud'
    ? (cloudStatus?.state || 'disconnected')
    : connectionStatus;
  const activeConnected = modeDraft === 'cloud'
    ? cloudStatus?.connected === true
    : connectionStatus === 'connected';

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
            <Text style={styles.subtitle}>Manage this phone, pairing, and connection behavior.</Text>
          </View>

          <GlassPanel style={styles.summaryCard} contentStyle={styles.summaryContent}>
            <View style={styles.summaryMain}>
              <View style={styles.summaryIcon}>
                <Ionicons color={colors.text} name="phone-portrait-outline" size={22} />
              </View>
              <View style={styles.summaryText}>
                <Text numberOfLines={1} style={styles.summaryName}>{phoneName || deviceName}</Text>
                <Text style={styles.summaryMeta}>{modeDraft === 'cloud' ? 'Cloud relay' : 'Local network'}</Text>
              </View>
            </View>
            <View style={[styles.summaryStatus, activeConnected ? styles.summaryStatusOn : styles.summaryStatusOff]}>
              <View style={[styles.summaryDot, activeConnected ? styles.summaryDotOn : styles.summaryDotOff]} />
              <Text style={styles.summaryStatusText}>{activeStatusText || 'offline'}</Text>
            </View>
          </GlassPanel>

          <Text style={styles.sectionTitle}>Connection mode</Text>
          <GlassPanel style={styles.card} contentStyle={styles.cardContent}>
            <View style={styles.modeRow}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: modeDraft === 'local' }}
                onPress={() => handleModeChange('local')}
                style={[styles.modeButton, modeDraft === 'local' && styles.modeButtonActive]}
              >
                <Ionicons color={colors.text} name="phone-portrait-outline" size={18} />
                <Text style={styles.modeButtonText}>Local</Text>
              </Pressable>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: modeDraft === 'cloud' }}
                onPress={() => handleModeChange('cloud')}
                style={[styles.modeButton, modeDraft === 'cloud' && styles.modeButtonActive]}
              >
                <Ionicons color={colors.text} name="cloud-outline" size={18} />
                <Text style={styles.modeButtonText}>Cloud</Text>
              </Pressable>
            </View>
            <Text style={styles.advancedText}>
              Local connects directly to OpenX Desktop. Cloud connects only to the relay server for this phase.
            </Text>
          </GlassPanel>

          {modeDraft === 'cloud' ? (
            <>
              <Text style={styles.sectionTitle}>Cloud connection</Text>
              <GlassPanel style={styles.card} contentStyle={styles.cardContent}>
                <View style={styles.statusRow}>
                  <Text style={styles.permissionLabel}>Status</Text>
                  <Text style={styles.statusText}>{cloudStatus?.state || 'disconnected'}</Text>
                </View>
                <Text style={styles.label}>Relay server</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  onChangeText={setRelayUrl}
                  placeholder="wss://openx-server.onrender.com/ws"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  style={styles.input}
                  value={relayUrl}
                />
                <View style={styles.switchList}>
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{ checked: cloudAutoConnect }}
                    onPress={() => setCloudAutoConnect((value) => !value)}
                    style={styles.switchRow}
                  >
                    <Text style={styles.permissionLabel}>Auto connect</Text>
                    <View style={[styles.switchTrack, cloudAutoConnect && styles.switchTrackOn]}>
                      <View style={[styles.switchThumb, cloudAutoConnect && styles.switchThumbOn]} />
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{ checked: cloudReconnect }}
                    onPress={() => setCloudReconnect((value) => !value)}
                    style={styles.switchRow}
                  >
                    <Text style={styles.permissionLabel}>Reconnect</Text>
                    <View style={[styles.switchTrack, cloudReconnect && styles.switchTrackOn]}>
                      <View style={[styles.switchThumb, cloudReconnect && styles.switchThumbOn]} />
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{ checked: cloudHeartbeat }}
                    onPress={() => setCloudHeartbeat((value) => !value)}
                    style={styles.switchRow}
                  >
                    <Text style={styles.permissionLabel}>Heartbeat</Text>
                    <View style={[styles.switchTrack, cloudHeartbeat && styles.switchTrackOn]}>
                      <View style={[styles.switchThumb, cloudHeartbeat && styles.switchThumbOn]} />
                    </View>
                  </Pressable>
                </View>
                <Text style={[styles.label, styles.fieldGap]}>Connection timeout</Text>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={5}
                  onChangeText={(value) => setCloudTimeout(value.replace(/\D/g, ''))}
                  placeholder="10000"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  style={styles.input}
                  value={cloudTimeout}
                />
                <View style={styles.cloudGrid}>
                  <Text style={styles.cloudMeta}>Attempts: {cloudStatus?.reconnectAttempts || 0}</Text>
                  <Text style={styles.cloudMeta}>Duration: {formatDuration(cloudStatus?.connectionDurationMs)}</Text>
                  <Text style={styles.cloudMeta}>Last: {formatDate(cloudStatus?.lastConnectedAt)}</Text>
                  <Text style={styles.cloudMeta}>Quality: {cloudStatus?.quality || 'Unavailable'}</Text>
                </View>
                <Text style={styles.updatedText}>
                  {cloudStatus?.friendlyMessage || 'Cloud mode is disconnected.'}
                </Text>
                <View style={styles.buttonRow}>
                  <GlassButton
                    disabled={cloudBusy}
                    iconName="save-outline"
                    label="Save"
                    loading={cloudBusy}
                    onPress={handleSaveCloud}
                    style={styles.buttonFlex}
                  />
                  <GlassButton
                    disabled={cloudBusy}
                    iconName={cloudStatus?.connected ? 'close-circle-outline' : 'cloud-outline'}
                    label={cloudStatus?.connected ? 'Disconnect' : 'Connect'}
                    loading={cloudBusy}
                    onPress={handleCloudToggle}
                    style={styles.buttonFlex}
                  />
                </View>
              </GlassPanel>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>Mobile name</Text>
          <GlassPanel style={styles.card} contentStyle={styles.cardContent}>
            <Text style={styles.label}>Phone name</Text>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={100}
              onChangeText={setPhoneName}
              placeholder="My Android Phone"
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

          <Text style={styles.sectionTitle}>Manual fallback</Text>
          <GlassPanel style={styles.card} contentStyle={styles.cardContent}>
            {!settingsLoaded ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <Text style={styles.label}>Desktop address</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  onChangeText={setAddress}
                  placeholder="192.168.1.100"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="next"
                  style={styles.input}
                  value={address}
                />

                <Text style={[styles.label, styles.fieldGap]}>Port</Text>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={5}
                  onChangeText={(value) => setPort(value.replace(/\D/g, ''))}
                  placeholder="8080"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  style={styles.input}
                  value={port}
                />

                <View style={styles.buttonRow}>
                  <GlassButton
                    disabled={testing || saving}
                    iconName="pulse-outline"
                    label="Test"
                    loading={testing}
                    onPress={handleTestConnection}
                    style={styles.buttonFlex}
                  />
                  <GlassButton
                    disabled={saving || testing}
                    iconName="save-outline"
                    label="Save"
                    loading={saving}
                    onPress={handleSave}
                    style={styles.buttonFlex}
                  />
                </View>
              </>
            )}
          </GlassPanel>

          <Text style={styles.sectionTitle}>Advanced connection</Text>
          <GlassPanel style={styles.card} contentStyle={styles.cardContent}>
            <Text style={styles.advancedText}>
              QR pairing is the normal path. Manual fallback is only for local network troubleshooting.
            </Text>
          </GlassPanel>
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
    marginBottom: spacing.lg,
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
  modeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modeButton: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 52,
  },
  modeButtonActive: {
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderBright,
  },
  modeButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  statusText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  switchList: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  switchRow: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  switchTrack: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.round,
    height: 26,
    justifyContent: 'center',
    padding: 3,
    width: 48,
  },
  switchTrackOn: {
    backgroundColor: 'rgba(70, 217, 145, 0.32)',
  },
  switchThumb: {
    backgroundColor: colors.textMuted,
    borderRadius: radius.round,
    height: 20,
    width: 20,
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
    backgroundColor: colors.success,
  },
  cloudGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cloudMeta: {
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textSecondary,
    flexGrow: 1,
    fontSize: 11,
    fontWeight: '700',
    minWidth: '46%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
