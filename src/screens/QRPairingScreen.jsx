import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FadeInView from '../components/FadeInView';
import GlassButton from '../components/GlassButton';
import GlassPanel from '../components/GlassPanel';
import MobileBottomDock from '../components/MobileBottomDock';
import ScreenBackground from '../components/ScreenBackground';
import { useApp } from '../context/AppContext';
import { parsePairingQrPayload } from '../services/qrPairing';
import { colors, radius, shadows, spacing } from '../styles/theme';

export default function QRPairingScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);
  const [scanError, setScanError] = useState('');
  const [pairing, setPairing] = useState(false);
  const scanProgress = useRef(new Animated.Value(0)).current;
  const {
    deviceName,
    pairCloudDevice,
    showNotice,
  } = useApp();
  const selectedDeviceName = route?.params?.deviceName || deviceName;
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const frameSize = Math.max(196, Math.min(width - spacing.xl * 2, height * 0.31, 300));
  const scanLineMax = Math.max(18, frameSize - 26);
  const canAskCameraPermission = permission?.canAskAgain !== false;

  const resetScanner = useCallback(() => {
    setScanError('');
    setScanLocked(false);
  }, []);

  const openAppSettings = useCallback(() => {
    Linking.openSettings().catch(() => {
      showNotice({
        title: 'Open settings',
        message: 'Open phone settings and allow camera access for OpenX.',
        tone: 'warning',
      });
    });
  }, [showNotice]);

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

  const showScanError = useCallback((message) => {
    setScanError(message || 'Pairing failed. Generate a fresh QR and try again.');
  }, []);

  const handleBarcodeScanned = async ({ data }) => {
    if (scanLocked) return;
    setScanLocked(true);
    setScanError('');
    setPairing(true);

    try {
      const payload = parsePairingQrPayload(data);
      if (payload.mode !== 'cloud') {
        throw new Error('Generate a Cloud QR in OpenX Desktop, then scan it here.');
      }
      await pairCloudDevice({
        relayUrl: payload.relayUrl,
        pairToken: payload.pairToken,
        security: payload.security,
        deviceName: selectedDeviceName,
      });
      showNotice({
        title: 'Pairing complete',
        message: 'Device paired through the relay successfully.',
        tone: 'success',
        actions: [{ label: 'Continue', tone: 'primary', onPress: () => navigation.popToTop() }],
      });
    } catch (error) {
      const errorMessage = error?.message || '';
      const message =
        errorMessage === 'Invalid or expired pairing code.'
          ? 'Pairing failed.'
          : errorMessage;
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
        <MobileBottomDock
          activeRoute="QRPairing"
          navigation={navigation}
        />
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
              OpenX uses the camera only to scan the pairing QR code shown by OpenX Desktop.
              Camera frames are not saved.
            </Text>
            <GlassButton
              iconName={canAskCameraPermission ? 'camera-outline' : 'settings-outline'}
              label={canAskCameraPermission ? 'Allow camera' : 'Open phone settings'}
              onPress={canAskCameraPermission ? requestPermission : openAppSettings}
              style={styles.permissionButton}
              tone="primary"
            />
            <Pressable
              accessibilityLabel="Go back home"
              accessibilityRole="button"
              onPress={() => navigation.popToTop()}
              style={({ pressed }) => [styles.permissionLink, pressed && styles.pressed]}
            >
              <Text style={styles.permissionLinkText}>Back to OpenX</Text>
            </Pressable>
          </GlassPanel>
        </FadeInView>
        <MobileBottomDock
          activeRoute="QRPairing"
          navigation={navigation}
        />
      </ScreenBackground>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        facing="back"
        onBarcodeScanned={scanLocked || scanError ? undefined : handleBarcodeScanned}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.scrim,
          {
            paddingBottom: insets.bottom + spacing.lg,
            paddingTop: insets.top + spacing.sm,
          },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Close QR scanner"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => navigation.popToTop()}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.white} name="close" size={22} />
          </Pressable>
        </View>

        <View style={styles.scanArea}>
          <View
            style={[
              styles.scannerFrame,
              {
                height: frameSize,
                width: frameSize,
              },
            ]}
          >
            <View style={styles.frameGlow} />
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {!pairing && !scanError && (
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [
                      {
                        translateY: scanProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [14, scanLineMax],
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}
            {scanError ? (
              <View style={styles.scanErrorOverlay}>
                <View style={styles.scanErrorIcon}>
                  <Ionicons color={colors.warning} name="alert-circle-outline" size={30} />
                </View>
                <Text style={styles.scanErrorTitle}>QR not accepted</Text>
                <Text style={styles.scanErrorText}>{scanError}</Text>
                <Pressable
                  accessibilityLabel="Scan again"
                  accessibilityRole="button"
                  onPress={resetScanner}
                  style={({ pressed }) => [styles.scanAgainButton, pressed && styles.pressed]}
                >
                  <Ionicons color={colors.background} name="scan-outline" size={18} />
                  <Text style={styles.scanAgainText}>Scan again</Text>
                </Pressable>
              </View>
            ) : null}
            {pairing && (
              <View style={styles.pairingOverlay}>
                <ActivityIndicator color={colors.white} size="large" />
                <Text style={styles.pairingText}>Pairing with OpenX Desktop...</Text>
              </View>
            )}
          </View>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  centeredContainer: {
    alignItems: 'center',
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
    backgroundColor: colors.glassStrong,
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
  permissionLink: {
    alignItems: 'center',
    borderRadius: radius.round,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  permissionLinkText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '900',
  },
  scrim: {
    alignItems: 'center',
    backgroundColor: 'rgba(3, 6, 14, 0.52)',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.36)',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: radius.round,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  scanArea: {
    alignItems: 'center',
    gap: spacing.lg,
    justifyContent: 'center',
    width: '100%',
  },
  scannerFrame: {
    ...shadows.floating,
    backgroundColor: 'rgba(7, 11, 20, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.42)',
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  frameGlow: {
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: radius.xl,
    bottom: 10,
    left: 10,
    position: 'absolute',
    right: 10,
    top: 10,
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
    backgroundColor: 'rgba(7, 11, 20, 0.9)',
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
  scanErrorOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 11, 20, 0.92)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    padding: spacing.lg,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  scanErrorIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(246, 185, 74, 0.12)',
    borderColor: 'rgba(246, 185, 74, 0.34)',
    borderRadius: radius.round,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  scanErrorTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  scanErrorText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  scanAgainButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.round,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
    minWidth: 148,
    paddingHorizontal: spacing.lg,
  },
  scanAgainText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '900',
  },
});
