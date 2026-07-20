import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
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
import MobileBottomDock, { getMobileBottomDockHeight } from '../components/MobileBottomDock';
import ScreenBackground from '../components/ScreenBackground';
import { useApp } from '../context/AppContext';
import { parsePairingQrPayload } from '../services/qrPairing';
import { colors, radius, shadows, spacing } from '../styles/theme';

export default function QRPairingScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);
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
  const bottomDockHeight = getMobileBottomDockHeight(insets);
  const frameSize = Math.max(220, Math.min(width - spacing.xl * 2, height * 0.36, 318));
  const scanLineMax = Math.max(18, frameSize - 26);

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
    showNotice({
      title: 'Unable to pair',
      message,
      tone: 'error',
      dismissible: false,
      actions: [
        { label: 'Home', onPress: () => navigation.popToTop() },
        { label: 'Scan again', tone: 'primary', onPress: () => setScanLocked(false) },
      ],
    });
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (scanLocked) return;
    setScanLocked(true);
    setPairing(true);

    try {
      const payload = parsePairingQrPayload(data);
      if (payload.mode !== 'cloud') {
        throw new Error('Local pairing is no longer supported. Generate a Cloud QR in OpenX Desktop.');
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
        onBarcodeScanned={scanLocked ? undefined : handleBarcodeScanned}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.scrim,
          {
            paddingBottom: bottomDockHeight + spacing.md,
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
          <View style={styles.topCopy}>
            <Text style={styles.topTitle}>Pair Desktop</Text>
            <Text style={styles.topSubtitle}>Cloud relay QR</Text>
          </View>
          <View style={styles.scannerStatus}>
            <View style={styles.scannerStatusDot} />
            <Text style={styles.scannerStatusText}>Live</Text>
          </View>
        </View>

        <View style={styles.scanArea}>
          <View style={styles.instructions}>
            <Text style={styles.title}>Scan OpenX QR</Text>
            <Text style={styles.subtitle}>
              Point your camera at the QR code shown in OpenX Desktop.
            </Text>
          </View>

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
            {!pairing && (
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
            {pairing && (
              <View style={styles.pairingOverlay}>
                <ActivityIndicator color={colors.white} size="large" />
                <Text style={styles.pairingText}>Pairing with OpenX Desktop...</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.hintCard}>
          <View style={styles.hintIcon}>
            <Ionicons color={colors.text} name="desktop-outline" size={20} />
          </View>
          <View style={styles.hintCopy}>
            <Text style={styles.hintTitle}>Open desktop settings</Text>
            <Text style={styles.hintText}>
              Go to Mobile pairing and keep the QR inside this frame.
            </Text>
          </View>
        </View>

      </View>
      <MobileBottomDock
        activeRoute="QRPairing"
        navigation={navigation}
      />
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
  scrim: {
    alignItems: 'center',
    backgroundColor: 'rgba(3, 6, 14, 0.52)',
    flex: 1,
    justifyContent: 'space-between',
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
  topCopy: {
    flex: 1,
    minWidth: 0,
  },
  topTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
  },
  topSubtitle: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  scannerStatus: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.34)',
    borderColor: 'rgba(255, 255, 255, 0.20)',
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  scannerStatusDot: {
    backgroundColor: colors.success,
    borderRadius: radius.round,
    height: 7,
    width: 7,
  },
  scannerStatusText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
  },
  scanArea: {
    alignItems: 'center',
    gap: spacing.lg,
    justifyContent: 'center',
    width: '100%',
  },
  instructions: { alignItems: 'center' },
  title: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '900',
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
  hintCard: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: 'rgba(10, 12, 18, 0.72)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    width: '100%',
  },
  hintIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  hintCopy: {
    flex: 1,
    minWidth: 0,
  },
  hintTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  hintText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
});
