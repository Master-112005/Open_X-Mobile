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

import ConnectionStatus from '../components/ConnectionStatus';
import FadeInView from '../components/FadeInView';
import ScreenBackground from '../components/ScreenBackground';
import { useApp } from '../context/AppContext';
import { colors, radius, shadows, spacing } from '../styles/theme';

const PERMISSION_ITEMS = [
  { key: 'remoteCommands', label: 'Remote Commands' },
  { key: 'fileTransfer', label: 'File Transfer' },
  { key: 'receiveFiles', label: 'Receive Files' },
  { key: 'sendFiles', label: 'Send Files' },
  { key: 'powerActions', label: 'Power Actions' },
];

export default function SettingsScreen({ navigation }) {
  const {
    connectionStatus,
    desktopAddress,
    desktopPort,
    saveSettings,
    settingsLoaded,
    testConnection,
    permissions,
    permissionsLastUpdated,
    permissionsLoaded,
  } = useApp();
  const [address, setAddress] = useState(desktopAddress);
  const [port, setPort] = useState(desktopPort);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [advancedVisible, setAdvancedVisible] = useState(false);

  useEffect(() => {
    if (settingsLoaded) {
      setAddress(desktopAddress);
      setPort(desktopPort);
    }
  }, [desktopAddress, desktopPort, settingsLoaded]);

  const handleSave = async () => {
    if (
      port &&
      (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    ) {
      Alert.alert('Invalid port', 'Enter a port number between 1 and 65535.');
      return;
    }

    setSaving(true);
    try {
      await saveSettings(address, port);
      Alert.alert(
        'Advanced settings saved',
        'The desktop connection fallback was stored on this device.',
      );
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

    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      Alert.alert('Invalid port', 'Enter a port number between 1 and 65535.');
      return;
    }

    setTesting(true);
    try {
      await testConnection(address, port);
      Alert.alert('Connection successful', 'OpenX Desktop is reachable.');
    } catch {
      Alert.alert('Connection pending', 'Waiting for OpenX Desktop...');
    } finally {
      setTesting(false);
    }
  };

  return (
    <ScreenBackground>
      <FadeInView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ConnectionStatus status={connectionStatus} />
            <View style={styles.heading}>
              <Text style={styles.eyebrow}>CONNECTION</Text>
              <Text style={styles.title}>OpenX setup</Text>
              <Text style={styles.subtitle}>
                Pair this phone by scanning the QR code shown by OpenX Desktop.
                Saved connection details are reused automatically on every launch.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('PairDevice')}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Pair Device</Text>
                <Text style={styles.actionText}>
                  Scan the QR code displayed by OpenX Desktop
                </Text>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Transfers')}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>File Transfers</Text>
                <Text style={styles.actionText}>
                  Send and receive files with OpenX Desktop
                </Text>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </Pressable>

            <View style={styles.permissionsSection}>
              <Text style={styles.permissionsTitle}>Device Permissions</Text>
              <Text style={styles.permissionsSubtitle}>
                Desktop controls permissions. These settings are read-only.
              </Text>

              <View style={styles.permissionsCard}>
                {permissionsLoaded ? (
                  PERMISSION_ITEMS.map((item, index) => {
                    const allowed = permissions[item.key];
                    return (
                      <View
                        key={item.key}
                        style={[
                          styles.permissionRow,
                          index === PERMISSION_ITEMS.length - 1 &&
                            styles.permissionRowLast,
                        ]}
                      >
                        <Text style={styles.permissionLabel}>{item.label}</Text>
                        <View
                          style={[
                            styles.permissionBadge,
                            allowed
                              ? styles.permissionBadgeAllowed
                              : styles.permissionBadgeDisabled,
                          ]}
                        >
                          <Text
                            style={[
                              styles.permissionValue,
                              allowed
                                ? styles.permissionValueAllowed
                                : styles.permissionValueDisabled,
                            ]}
                          >
                            {allowed ? 'Allowed' : 'Disabled'}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <ActivityIndicator
                    color={colors.primary}
                    style={styles.permissionLoader}
                  />
                )}
              </View>

              <Text style={styles.permissionsUpdated}>
                {permissionsLastUpdated
                  ? `Last updated ${new Date(permissionsLastUpdated).toLocaleString()}`
                  : 'Waiting for permission update from desktop'}
              </Text>

              {permissionsLoaded && !permissions.powerActions && (
                <Text style={styles.powerRestriction}>
                  Power actions disabled.
                </Text>
              )}
            </View>

            <View style={styles.advancedSection}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAdvancedVisible((visible) => !visible)}
                style={({ pressed }) => [
                  styles.advancedToggle,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>Advanced Settings</Text>
                  <Text style={styles.actionText}>
                    Manual desktop address fallback for diagnostics
                  </Text>
                </View>
                <Text style={styles.actionArrow}>
                  {advancedVisible ? '⌃' : '⌄'}
                </Text>
              </Pressable>

              {advancedVisible && (
                <View style={styles.card}>
                  {!settingsLoaded ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Text style={styles.advancedWarning}>
                        Normal setup uses QR pairing. Change these values only
                        when troubleshooting a local network connection.
                      </Text>

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

                      <Text style={[styles.label, styles.portLabel]}>Port</Text>
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

                      <Pressable
                        accessibilityRole="button"
                        disabled={testing || saving}
                        onPress={handleTestConnection}
                        style={({ pressed }) => [
                          styles.testButton,
                          pressed && styles.testButtonPressed,
                          (testing || saving) && styles.saveButtonDisabled,
                        ]}
                      >
                        {testing ? (
                          <ActivityIndicator color={colors.primary} />
                        ) : (
                          <Text style={styles.testText}>Test connection</Text>
                        )}
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        disabled={saving || testing}
                        onPress={handleSave}
                        style={({ pressed }) => [
                          styles.saveButton,
                          pressed && styles.saveButtonPressed,
                          (saving || testing) && styles.saveButtonDisabled,
                        ]}
                      >
                        {saving ? (
                          <ActivityIndicator color={colors.white} />
                        ) : (
                          <Text style={styles.saveText}>
                            Save advanced settings
                          </Text>
                        )}
                      </Pressable>
                    </>
                  )}
                </View>
              )}
            </View>

            <View style={styles.note}>
              <Text style={styles.noteTitle}>Automatic connection</Text>
              <Text style={styles.noteText}>
                OpenX Mobile reconnects every five seconds when Wi-Fi or OpenX
                Desktop becomes unavailable. QR pairing stores the desktop
                address, port, device identity, and session for future launches.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </FadeInView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: spacing.xxl },
  heading: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  actionButton: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
  },
  actionButtonPressed: { backgroundColor: colors.surfaceElevated },
  actionCopy: { flex: 1, paddingRight: spacing.md },
  actionTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  actionText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  actionArrow: { color: colors.primary, fontSize: 28, fontWeight: '700' },
  permissionsSection: { marginBottom: spacing.lg, marginHorizontal: spacing.lg },
  permissionsTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  permissionsSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  permissionsCard: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  permissionRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  permissionRowLast: { borderBottomWidth: 0 },
  permissionLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  permissionBadge: {
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  permissionBadgeAllowed: { backgroundColor: '#112D24' },
  permissionBadgeDisabled: { backgroundColor: '#351D25' },
  permissionValue: { fontSize: 10, fontWeight: '800' },
  permissionValueAllowed: { color: '#83E7B3' },
  permissionValueDisabled: { color: '#F1848D' },
  permissionLoader: { margin: spacing.xl },
  permissionsUpdated: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: spacing.sm,
  },
  powerRestriction: {
    color: '#F6B94A',
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  advancedSection: { marginBottom: spacing.lg },
  advancedToggle: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
  },
  card: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    minHeight: 310,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  advancedWarning: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  portLabel: { marginTop: spacing.lg },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    height: 50,
    paddingHorizontal: 14,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    height: 50,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  saveButtonPressed: { backgroundColor: colors.primaryPressed },
  saveButtonDisabled: { opacity: 0.65 },
  saveText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  testButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryMuted,
    borderColor: '#3854A0',
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  testButtonPressed: { backgroundColor: '#24376D' },
  testText: { color: '#B9C8FF', fontSize: 15, fontWeight: '700' },
  note: {
    backgroundColor: colors.primaryMuted,
    borderColor: '#283C76',
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
  },
  noteTitle: { color: '#B9C8FF', fontSize: 13, fontWeight: '700' },
  noteText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
