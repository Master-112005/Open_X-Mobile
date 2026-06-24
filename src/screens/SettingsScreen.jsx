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
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../styles/theme';

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
      Alert.alert('Settings saved', 'Desktop details were stored on this device.');
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
      Alert.alert('Connection failed', 'Unable to connect to OpenX Desktop.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ConnectionStatus status={connectionStatus} />
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>CONNECTION</Text>
          <Text style={styles.title}>Desktop settings</Text>
          <Text style={styles.subtitle}>
            Enter the local network address exposed by your OpenX Desktop
            WebSocket server.
          </Text>
        </View>

        <View style={styles.card}>
          {!settingsLoaded ? (
            <ActivityIndicator color={colors.primary} />
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
                  <Text style={styles.saveText}>Save settings</Text>
                )}
              </Pressable>
            </>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('PairDevice')}
          style={({ pressed }) => [
            styles.pairDeviceButton,
            pressed && styles.testButtonPressed,
          ]}
        >
          <View>
            <Text style={styles.pairDeviceTitle}>Pair Device</Text>
            <Text style={styles.pairDeviceText}>
              Enter the code displayed by OpenX Desktop
            </Text>
          </View>
          <Text style={styles.pairDeviceArrow}>›</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Transfers')}
          style={({ pressed }) => [
            styles.pairDeviceButton,
            pressed && styles.testButtonPressed,
          ]}
        >
          <View>
            <Text style={styles.pairDeviceTitle}>File Transfers</Text>
            <Text style={styles.pairDeviceText}>
              Send and receive files with OpenX Desktop
            </Text>
          </View>
          <Text style={styles.pairDeviceArrow}>›</Text>
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
              <ActivityIndicator color={colors.primary} style={styles.permissionLoader} />
            )}
          </View>

          <Text style={styles.permissionsUpdated}>
            {permissionsLastUpdated
              ? `Last updated ${new Date(permissionsLastUpdated).toLocaleString()}`
              : 'Waiting for permission update from desktop'}
          </Text>

          {permissionsLoaded && !permissions.powerActions && (
            <Text style={styles.powerRestriction}>Power actions disabled.</Text>
          )}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Local network connection</Text>
          <Text style={styles.noteText}>
            OpenX Mobile reconnects every five seconds when the desktop becomes
            unavailable. This phase uses the desktop's unencrypted WebSocket
            endpoint. Pairing information remains stored across reconnects.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
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
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    margin: spacing.lg,
    minHeight: 310,
    padding: spacing.lg,
    justifyContent: 'center',
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
  pairDeviceButton: {
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
  pairDeviceTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pairDeviceText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  pairDeviceArrow: { color: colors.primary, fontSize: 28 },
  permissionsSection: { marginBottom: spacing.lg, marginHorizontal: spacing.lg },
  permissionsTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  permissionsSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  permissionsCard: {
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
