import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import FadeInView from '../components/FadeInView';
import GlassButton from '../components/GlassButton';
import GlassPanel from '../components/GlassPanel';
import ScreenBackground from '../components/ScreenBackground';
import { useApp } from '../context/AppContext';
import { parsePairingQrPayload } from '../services/qrPairing';
import { colors, radius, spacing } from '../styles/theme';

export default function QRPairingScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);
  const [pairing, setPairing] = useState(false);
  const scanProgress = useRef(new Animated.Value(0)).current;
  const {
    deviceName,
    pairDevice,
    testConnection,
  } = useApp();
  const selectedDeviceName = route.params?.deviceName || deviceName;

  useEffect(() => {
    let animation;
    let active = true;
    if (!permission?.granted) return undefined;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active || reduceMotion) return;
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanProgress, {
            duration: 1800,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(scanProgress, {
            duration: 1800,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
    });

    return () => {
      active = false;
      animation?.stop();
    };
  }, [permission?.granted, scanProgress]);

  const showScanError = (message) => {
    Alert.alert('Unable to pair', message, [
      { text: 'Scan again', onPress: () => setScanLocked(false) },
      { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
    ]);
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (scanLocked) return;
    setScanLocked(true);
    setPairing(true);

    try {
      const payload = parsePairingQrPayload(data);
      const port = String(payload.serverPort);
      const candidates = payload.serverIpCandidates?.length
        ? payload.serverIpCandidates
        : [payload.serverIp];
      let connected = false;
      let lastConnectionError = null;

      for (const address of candidates) {
        try {
          await testConnection(address, port);
          connected = true;
          break;
        } catch (connectionError) {
          lastConnectionError = connectionError;
        }
      }

      if (!connected) {
        throw new Error(
          lastConnectionError?.message || 'Waiting for OpenX Desktop...',
        );
      }

      await pairDevice(selectedDeviceName, payload.pairingToken);

      Alert.alert('Pairing complete', 'Device paired successfully.', [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (error) {
      const message =
        error.message === 'Invalid or expired pairing code.'
          ? 'Pairing failed.'
          : error.message;
      showScanError(message || 'Pairing failed.');
    } finally {
      setPairing(false);
    }
  };

  if (!permission) {
    return (
      <ScreenBackground>
        <View style={styles.centeredContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </ScreenBackground>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenBackground>
        <FadeInView style={styles.permissionContainer}>
          <GlassPanel
            style={styles.permissionPanel}
            contentStyle={styles.permissionPanelContent}
          >
            <View style={styles.cameraIcon}>
              <Ionicons color={colors.text} name="qr-code-outline" size={34} />
            </View>
            <Text style={styles.permissionTitle}>Camera access required</Text>
            <Text style={styles.permissionText}>
              OpenX uses the camera only to scan the pairing QR code shown by
              OpenX Desktop.
            </Text>
            <GlassButton
              iconName="camera-outline"
              label="Allow camera"
              onPress={requestPermission}
              style={styles.permissionButton}
              tone="primary"
            />
            <GlassButton
              iconName="chevron-back"
              label="Cancel"
              onPress={() => navigation.goBack()}
              style={styles.permissionButton}
            />
          </GlassPanel>
        </FadeInView>
      </ScreenBackground>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        facing="back"
        onBarcodeScanned={scanLocked ? undefined : handleBarcodeScanned}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.scrim}>
        <View style={styles.instructions}>
          <Text style={styles.title}>Scan pairing QR</Text>
          <Text style={styles.subtitle}>
            Align the QR code from OpenX Desktop inside the frame.
          </Text>
        </View>

        <View style={styles.scannerFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          {!pairing && (
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [
                    {
                      translateY: scanProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [14, 250],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}
          {pairing && (
            <View style={styles.pairingOverlay}>
              <ActivityIndicator color={colors.white} size="large" />
              <Text style={styles.pairingText}>Pairing with OpenX Desktop...</Text>
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={pairing}
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.cameraCancelButton,
            pairing && styles.buttonDisabled,
            pressed && !pairing && styles.cameraCancelButtonPressed,
          ]}
        >
          <Text style={styles.cameraCancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  centeredContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  permissionContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  permissionPanel: { alignSelf: 'stretch' },
  permissionPanelContent: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  cameraIcon: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.borderBright,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    marginBottom: spacing.xl,
    width: 72,
  },
  permissionTitle: { color: colors.text, fontSize: 24, fontWeight: '700' },
  permissionText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
    maxWidth: 340,
    textAlign: 'center',
  },
  permissionButton: { alignSelf: 'stretch', marginTop: spacing.md },
  scrim: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  instructions: { alignItems: 'center' },
  title: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '700',
    textShadowColor: '#000000',
    textShadowRadius: 4,
  },
  subtitle: {
    color: '#D8E0ED',
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
    maxWidth: 300,
    textAlign: 'center',
  },
  scannerFrame: {
    backgroundColor: 'rgba(7, 11, 20, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 270,
    overflow: 'hidden',
    position: 'relative',
    width: 270,
  },
  scanLine: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 2,
    left: 10,
    opacity: 0.85,
    position: 'absolute',
    right: 10,
    shadowColor: colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  corner: {
    borderColor: colors.primary,
    height: 46,
    position: 'absolute',
    width: 46,
  },
  topLeft: { borderLeftWidth: 4, borderTopWidth: 4, left: 0, top: 0 },
  topRight: { borderRightWidth: 4, borderTopWidth: 4, right: 0, top: 0 },
  bottomLeft: { borderBottomWidth: 4, borderLeftWidth: 4, bottom: 0, left: 0 },
  bottomRight: {
    borderBottomWidth: 4,
    borderRightWidth: 4,
    bottom: 0,
    right: 0,
  },
  pairingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 11, 20, 0.88)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  pairingText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  cameraCancelButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 11, 20, 0.78)',
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: radius.round,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 140,
  },
  cameraCancelButtonPressed: { backgroundColor: 'rgba(21, 30, 48, 0.95)' },
  cameraCancelText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
});
