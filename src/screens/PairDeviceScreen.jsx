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

export default function PairDeviceScreen({ navigation }) {
  const {
    connectionStatus,
    deviceName,
    paired,
    pairingLoaded,
    pairDevice,
  } = useApp();
  const [name, setName] = useState(deviceName);
  const [code, setCode] = useState('');
  const [pairing, setPairing] = useState(false);

  useEffect(() => {
    if (pairingLoaded) setName(deviceName);
  }, [deviceName, pairingLoaded]);

  const handlePair = async () => {
    if (!name.trim() || !code.trim()) {
      Alert.alert('Missing information', 'Enter a device name and pairing code.');
      return;
    }

    setPairing(true);
    try {
      await pairDevice(name, code);
      setCode('');
      Alert.alert('Pairing complete', 'Device paired successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Pairing failed', error.message);
    } finally {
      setPairing(false);
    }
  };

  const canPair =
    pairingLoaded &&
    connectionStatus === 'connected' &&
    name.trim().length > 0 &&
    code.trim().length > 0 &&
    !pairing;

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
          <Text style={styles.eyebrow}>DEVICE PAIRING</Text>
          <Text style={styles.title}>Pair Device</Text>
          <Text style={styles.subtitle}>
            Enter the one-time code or scan the QR shown by OpenX Desktop.
          </Text>
        </View>

        <View style={styles.card}>
          {!pairingLoaded ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              {paired && (
                <View style={styles.pairedBadge}>
                  <View style={styles.pairedDot} />
                  <Text style={styles.pairedText}>This device is paired</Text>
                </View>
              )}

              <Text style={styles.optionTitle}>Enter Pairing Code</Text>
              <Text style={styles.label}>Device Name</Text>
              <TextInput
                autoCapitalize="words"
                maxLength={80}
                onChangeText={setName}
                placeholder="My Android Phone"
                placeholderTextColor={colors.textMuted}
                returnKeyType="next"
                style={styles.input}
                value={name}
              />

              <Text style={[styles.label, styles.codeLabel]}>Pairing Code</Text>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={32}
                onChangeText={(value) =>
                  setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                }
                onSubmitEditing={handlePair}
                placeholder="ABC123XY"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                style={[styles.input, styles.codeInput]}
                value={code}
              />

              {connectionStatus !== 'connected' && (
                <Text style={styles.connectionHint}>
                  Connect to OpenX Desktop before pairing.
                </Text>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={!canPair}
                onPress={handlePair}
                style={({ pressed }) => [
                  styles.pairButton,
                  !canPair && styles.buttonDisabled,
                  pressed && canPair && styles.pairButtonPressed,
                ]}
              >
                {pairing ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.pairButtonText}>Pair Device</Text>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={!pairingLoaded || pairing}
                onPress={() =>
                  navigation.navigate('QRPairing', {
                    deviceName: name.trim() || deviceName,
                  })
                }
                style={({ pressed }) => [
                  styles.scanButton,
                  (!pairingLoaded || pairing) && styles.buttonDisabled,
                  pressed && !pairing && styles.scanButtonPressed,
                ]}
              >
                <Text style={styles.scanButtonText}>Scan QR</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={pairing}
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pairing && styles.buttonDisabled,
                  pressed && !pairing && styles.cancelButtonPressed,
                ]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>

        <Text style={styles.privacyNote}>
          The device identifier is generated once and stored only on this phone.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.xxl },
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
    fontWeight: '700',
    letterSpacing: -0.7,
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
    minHeight: 380,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  pairedBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#112D24',
    borderRadius: radius.round,
    flexDirection: 'row',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pairedDot: {
    backgroundColor: colors.success,
    borderRadius: radius.round,
    height: 7,
    marginRight: spacing.sm,
    width: 7,
  },
  pairedText: { color: '#83E7B3', fontSize: 11, fontWeight: '700' },
  optionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  codeLabel: { marginTop: spacing.lg },
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
  codeInput: { fontSize: 18, fontWeight: '700', letterSpacing: 2 },
  connectionHint: {
    color: '#F6B94A',
    fontSize: 12,
    marginTop: spacing.md,
  },
  pairButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    height: 50,
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  pairButtonPressed: { backgroundColor: colors.primaryPressed },
  pairButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: spacing.lg,
  },
  dividerLine: { backgroundColor: colors.border, flex: 1, height: 1 },
  dividerText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginHorizontal: spacing.md,
  },
  scanButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryMuted,
    borderColor: '#3854A0',
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
  },
  scanButtonPressed: { backgroundColor: '#24376D' },
  scanButtonText: { color: '#B9C8FF', fontSize: 15, fontWeight: '700' },
  cancelButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  cancelButtonPressed: { backgroundColor: colors.surfaceElevated },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: { opacity: 0.5 },
  privacyNote: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    marginHorizontal: spacing.xl,
    textAlign: 'center',
  },
});
