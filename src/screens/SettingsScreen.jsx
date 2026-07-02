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
import { colors, radius, spacing } from '../styles/theme';

const PERMISSION_ITEMS = [
  { key: 'remoteCommands', label: 'Desktop commands' },
  { key: 'fileTransfer', label: 'File transfer' },
  { key: 'receiveFiles', label: 'Receive files' },
  { key: 'sendFiles', label: 'Send files' },
  { key: 'powerActions', label: 'Power actions' },
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
    permissions,
    permissionsLastUpdated,
    permissionsLoaded,
    saveSettings,
    settingsLoaded,
    testConnection,
  } = useApp();
  const [address, setAddress] = useState(desktopAddress);
  const [port, setPort] = useState(desktopPort);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (settingsLoaded) {
      setAddress(desktopAddress);
      setPort(desktopPort);
    }
  }, [desktopAddress, desktopPort, settingsLoaded]);

  const validatePort = () => /^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535;

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
          <Text style={styles.title}>Settings</Text>

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
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: spacing.xl,
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
  advancedText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
