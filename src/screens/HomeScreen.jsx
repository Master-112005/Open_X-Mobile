import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ChatBubble from '../components/ChatBubble';
import MobileBottomDock, { getMobileBottomDockHeight } from '../components/MobileBottomDock';
import ScreenBackground from '../components/ScreenBackground';
import SegmentedSlider from '../components/SegmentedSlider';
import { useApp } from '../context/AppContext';
import MobileChatPanel from './MobileChatPanel';
import MobileRemotePanel from './MobileRemotePanel';
import {
  formatFileSize,
  isImageTransferFile,
  pickTransferFile,
} from '../services/fileTransfer';
import { parseMobileScheduleCommand } from '../services/mobileScheduleIntelligence';
import { colors, gradients, radius, shadows, spacing } from '../styles/theme';

const WORKSPACE_OPTIONS = [
  { label: 'Assistant', value: 'assistant' },
  { label: 'Chat', value: 'chat' },
  { label: 'Remote', value: 'remote' },
];

function ConnectionDot({ status, onReconnect }) {
  const online = status === 'connected';
  const busy = status === 'connecting' || status === 'reconnecting';
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!busy) {
      spin.stopAnimation();
      spin.setValue(0);
      return undefined;
    }
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 850,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [busy, spin]);
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const canReconnect = !online && !busy;
  return (
    <Pressable
      accessibilityHint={canReconnect ? 'Attempts to reconnect OpenX Mobile.' : undefined}
      accessibilityLabel={online ? 'OpenX connected' : busy ? 'OpenX reconnecting' : 'Reconnect OpenX'}
      accessibilityRole="button"
      disabled={!canReconnect}
      hitSlop={8}
      onPress={onReconnect}
      style={({ pressed }) => [styles.connectionPill, pressed && styles.floatPressed]}
    >
      {busy ? (
        <Animated.View style={[styles.connectionSpinner, { transform: [{ rotate }] }]} />
      ) : null}
      <View style={[styles.connectionDot, online ? styles.online : styles.offline]} />
    </Pressable>
  );
}

function buildConnectionGuidance({ activeConnectionStatus, cloudStatus, paired }) {
  const status = String(activeConnectionStatus || '').toLowerCase();
  const connecting = status === 'connecting' || status === 'reconnecting';
  if (status === 'connected') return null;

  if (!paired) {
    return {
      iconName: 'qr-code-outline',
      title: 'Connect OpenX Desktop',
      message: 'Scan the QR from OpenX Desktop. The phone can scan even when it shows disconnected.',
      primaryLabel: 'Scan QR',
      secondaryLabel: 'Settings',
      tone: 'warning',
    };
  }

  if (connecting) {
    return {
      iconName: 'sync-outline',
      title: 'Reconnecting',
      message: 'OpenX is restoring the link. You can keep using local reminders while it connects.',
      primaryLabel: 'Scan QR',
      secondaryLabel: 'Settings',
      tone: 'info',
    };
  }

  return {
    iconName: 'cloud-offline-outline',
    title: 'Desktop disconnected',
    message: cloudStatus?.friendlyMessage || 'Reconnect to the relay, or scan a fresh QR if Desktop pairing changed.',
    primaryLabel: 'Reconnect',
    secondaryLabel: 'Scan QR',
    tone: 'warning',
  };
}

function ConnectionRecoveryCard({
  compact = false,
  guidance,
  onReconnect,
  onScanQr,
  onSettings,
}) {
  if (!guidance) return null;
  const primaryIsReconnect = guidance.primaryLabel === 'Reconnect';
  const secondaryIsSettings = guidance.secondaryLabel === 'Settings';

  return (
    <LinearGradient
      colors={gradients.glassSoft}
      style={[styles.connectionCard, compact && styles.connectionCardCompact]}
    >
      <View style={styles.connectionCardHeader}>
        <View style={[styles.connectionCardIcon, styles[`connectionCardIcon_${guidance.tone}`]]}>
          <Ionicons color={colors.text} name={guidance.iconName} size={22} />
        </View>
        <View style={styles.connectionCardCopy}>
          <Text style={styles.connectionCardTitle}>{guidance.title}</Text>
          <Text style={styles.connectionCardText}>{guidance.message}</Text>
        </View>
      </View>
      <View style={styles.connectionCardActions}>
        <Pressable
          accessibilityLabel={guidance.primaryLabel}
          accessibilityRole="button"
          onPress={primaryIsReconnect ? onReconnect : onScanQr}
          style={({ pressed }) => [
            styles.connectionPrimaryAction,
            pressed && styles.smallPressed,
          ]}
        >
          <Ionicons
            color={colors.background}
            name={primaryIsReconnect ? 'refresh' : 'qr-code-outline'}
            size={18}
          />
          <Text style={styles.connectionPrimaryText}>{guidance.primaryLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={guidance.secondaryLabel}
          accessibilityRole="button"
          onPress={secondaryIsSettings ? onSettings : onScanQr}
          style={({ pressed }) => [
            styles.connectionSecondaryAction,
            pressed && styles.smallPressed,
          ]}
        >
          <Ionicons
            color={colors.text}
            name={secondaryIsSettings ? 'settings-outline' : 'qr-code-outline'}
            size={18}
          />
          <Text style={styles.connectionSecondaryText}>{guidance.secondaryLabel}</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

export default function HomeScreen({ navigation }) {
  const {
    messages,
    connectionStatus,
    connectionMode,
    cloudStatus,
    deviceName,
    paired,
    pairingLoaded,
    permissions,
    permissionsLoaded,
    sessionLoaded,
    sessionValid,
    remoteTargets,
    remoteControlStatus,
    remoteControlBusy,
    sendMessage,
    refreshRemoteTargets,
    sendRemoteControl,
    sendFile,
    reconnectActiveConnection,
    showNotice,
  } = useApp();
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectingFile, setSelectingFile] = useState(false);
  const [sendingFile, setSendingFile] = useState(false);
  const [workspace, setWorkspace] = useState('assistant');
  const listRef = useRef(null);
  const scrollFrameRef = useRef(null);
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, spacing.sm);
  const bottomActionHeight = getMobileBottomDockHeight(insets);
  const assistantDockHeight = bottomActionHeight + 58 + spacing.sm;
  const topControlsHeight = insets.top + spacing.sm + 54 + spacing.lg;
  const activeConnectionStatus = connectionMode === 'cloud'
    ? cloudStatus?.state
    : connectionStatus;

  const commandRestriction = connectionMode === 'cloud'
    ? (!paired
        ? 'Pair this mobile app with OpenX Desktop.'
        : !cloudStatus?.connected
          ? 'Connect to OpenX Relay.'
          : null)
    : !pairingLoaded || !paired
      ? 'Pair this mobile app with OpenX Desktop.'
      : !permissionsLoaded
        ? 'Checking desktop permissions.'
        : !permissions.remoteCommands
          ? 'Remote commands are disabled.'
          : !sessionLoaded
            ? 'Checking session.'
            : !sessionValid
              ? 'Session expired. Reconnect with QR.'
              : null;

  const localScheduleCommand = useMemo(() => parseMobileScheduleCommand(text), [text]);
  const canSendText = text.trim().length > 0 && (!commandRestriction || Boolean(localScheduleCommand));
  const canSendFile = connectionMode === 'cloud'
    ? paired && cloudStatus?.connected
    : paired &&
      permissionsLoaded &&
      permissions.fileTransfer &&
      permissions.sendFiles &&
      sessionLoaded &&
      sessionValid;
  const selectedFileIsImage = useMemo(() => isImageTransferFile(selectedFile), [selectedFile]);
  const previewImageUri = useMemo(() => {
    const source = String(imagePreview?.imageUri || imagePreview?.thumbnailUri || imagePreview?.uri || imagePreview?.url || '');
    return /^(?:https?:|file:|content:|data:image\/)/i.test(source) ? source : '';
  }, [imagePreview]);
  const connectionGuidance = useMemo(() => buildConnectionGuidance({
    activeConnectionStatus,
    cloudStatus,
    paired,
  }), [activeConnectionStatus, cloudStatus, paired]);

  const composerHint = useMemo(() => {
    if (selectedFile) return selectedFile.fileName;
    if (commandRestriction) return 'Try: remind me in 10 minutes';
    return commandRestriction || 'Message OpenX';
  }, [commandRestriction, selectedFile]);

  const scrollToNewest = useCallback(() => {
    if (scrollFrameRef.current) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => () => {
    if (scrollFrameRef.current) {
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
  }, []);

  const handlePickFile = useCallback(async () => {
    if (!canSendFile) {
      showNotice({ title: 'File transfer unavailable', message: cloudStatus?.friendlyMessage || 'Connect and pair with OpenX Desktop before sending a file.', tone: 'warning' });
      return;
    }
    setSelectingFile(true);
    try {
      const file = await pickTransferFile();
      if (file) setSelectedFile(file);
    } catch (error) {
      showNotice({ title: 'Unable to select file', message: error.message, tone: 'error' });
    } finally {
      setSelectingFile(false);
    }
  }, [canSendFile, cloudStatus?.friendlyMessage, showNotice]);

  const handleSend = async () => {
    if (selectedFile) {
      if (!canSendFile || sendingFile) return;
      setSendingFile(true);
      try {
        await sendFile(selectedFile);
        setSelectedFile(null);
      } catch (error) {
        showNotice({ title: 'Transfer failed', message: error.message, tone: 'error' });
      } finally {
        setSendingFile(false);
      }
      return;
    }

    if (!canSendText) return;
    if (sendMessage(text)) setText('');
  };

  const handleChoice = useCallback((value) => {
    if (!commandRestriction && sendMessage(value)) {
      scrollToNewest();
    }
  }, [commandRestriction, scrollToNewest, sendMessage]);

  const renderMessage = useCallback(({ item }) => (
    <ChatBubble
      message={item}
      onChoice={handleChoice}
      onPreview={setImagePreview}
    />
  ), [handleChoice]);

  const keyMessage = useCallback((item) => item.id, []);

  const handleReconnect = useCallback(() => {
    reconnectActiveConnection?.().catch((error) => {
      showNotice({ title: 'Unable to reconnect', message: error.message || 'Unable to reconnect OpenX.', tone: 'error' });
    });
  }, [reconnectActiveConnection, showNotice]);
  const handleOpenPairing = useCallback(() => {
    navigation.navigate('QRPairing');
  }, [navigation]);
  const handleOpenSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);
  const assistantConnectionCard = useMemo(() => (
    connectionGuidance ? (
      <ConnectionRecoveryCard
        compact={messages.length > 0}
        guidance={connectionGuidance}
        onReconnect={handleReconnect}
        onScanQr={handleOpenPairing}
        onSettings={handleOpenSettings}
      />
    ) : null
  ), [connectionGuidance, handleOpenPairing, handleOpenSettings, handleReconnect, messages.length]);

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.screen}
      >
        <View style={[styles.topLayer, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
          <View style={styles.modeRow} pointerEvents="auto">
            <SegmentedSlider
              accessibilityLabel="OpenX mobile mode"
              onChange={setWorkspace}
              options={WORKSPACE_OPTIONS}
              style={styles.modeSlider}
              value={workspace}
            />
            <ConnectionDot status={activeConnectionStatus} onReconnect={handleReconnect} />
          </View>
        </View>

        {workspace === 'assistant' ? (
          <>
            <FlatList
              contentContainerStyle={[
                styles.listContent,
                connectionGuidance && messages.length === 0 && styles.listContentRecovery,
                { paddingTop: topControlsHeight + spacing.md, paddingBottom: assistantDockHeight + spacing.xl },
              ]}
              data={messages}
              initialNumToRender={14}
              keyExtractor={keyMessage}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={assistantConnectionCard}
              maxToRenderPerBatch={8}
              onContentSizeChange={scrollToNewest}
              onLayout={scrollToNewest}
              ref={listRef}
              removeClippedSubviews={Platform.OS === 'android'}
              renderItem={renderMessage}
              showsVerticalScrollIndicator={false}
              style={styles.list}
              updateCellsBatchingPeriod={48}
              windowSize={9}
            />
          </>
        ) : workspace === 'chat' ? (
          <MobileChatPanel
            bottomPadding={bottomActionHeight + spacing.sm}
            deviceName={deviceName}
            showNotice={showNotice}
            topPadding={topControlsHeight + spacing.md}
          />
        ) : (
          <MobileRemotePanel
            bottomPadding={bottomActionHeight + spacing.md}
            cloudStatus={cloudStatus}
            paired={paired}
            refreshRemoteTargets={refreshRemoteTargets}
            remoteControlBusy={remoteControlBusy}
            remoteControlStatus={remoteControlStatus}
            remoteTargets={remoteTargets}
            sendRemoteControl={sendRemoteControl}
            showNotice={showNotice}
            topPadding={topControlsHeight + spacing.md}
          />
        )}
        {workspace === 'assistant' ? (
          <View style={[styles.assistantDock, { paddingBottom: bottomInset }]}>
            <LinearGradient colors={gradients.glass} style={styles.composer}>
              <Pressable
                accessibilityLabel="Add file"
                accessibilityRole="button"
                disabled={selectingFile || sendingFile}
                onPress={handlePickFile}
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.smallPressed,
                  (selectingFile || sendingFile) && styles.disabled,
                ]}
              >
                <Ionicons color={colors.text} name="add" size={26} />
              </Pressable>
              <View style={styles.inputStack}>
                {selectedFile ? (
                  <View style={styles.fileChip}>
                    {selectedFileIsImage ? (
                      <Image source={{ uri: selectedFile.uri }} style={styles.filePreview} />
                    ) : (
                      <View style={styles.fileIcon}>
                        <Ionicons color={colors.textSecondary} name="document-outline" size={18} />
                      </View>
                    )}
                    <View style={styles.fileText}>
                      <Text numberOfLines={1} style={styles.fileName}>{selectedFile.fileName}</Text>
                      <Text style={styles.fileSize}>{formatFileSize(selectedFile.fileSize)}</Text>
                    </View>
                    <Pressable
                      accessibilityLabel="Remove selected file"
                      accessibilityRole="button"
                      disabled={sendingFile}
                      onPress={() => setSelectedFile(null)}
                      style={styles.clearFile}
                    >
                      <Ionicons color={colors.textSecondary} name="close" size={18} />
                    </Pressable>
                  </View>
                ) : (
                  <TextInput
                    accessibilityLabel="Message OpenX"
                    editable
                    maxLength={1000}
                    multiline
                    onChangeText={setText}
                    onSubmitEditing={handleSend}
                    placeholder={composerHint}
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="send"
                    style={styles.input}
                    submitBehavior="submit"
                    value={text}
                  />
                )}
              </View>
              <Pressable
                accessibilityLabel={selectedFile ? 'Send file' : 'Send message'}
                accessibilityRole="button"
                disabled={selectedFile ? !canSendFile || sendingFile : !canSendText}
                onPress={handleSend}
                style={({ pressed }) => [
                  styles.sendButton,
                  pressed && styles.smallPressed,
                  (selectedFile ? !canSendFile || sendingFile : !canSendText) && styles.disabled,
                ]}
              >
                <Ionicons
                  color={colors.background}
                  name={selectedFile ? 'cloud-upload-outline' : 'send'}
                  size={20}
                />
              </Pressable>
            </LinearGradient>
            <MobileBottomDock
              activeRoute="Home"
              fixed={false}
              includeSafeArea={false}
              navigation={navigation}
            />
          </View>
        ) : (
          <View style={[styles.actionDock, { paddingBottom: bottomInset }]}>
            <MobileBottomDock
              activeRoute="Home"
              fixed={false}
              includeSafeArea={false}
              navigation={navigation}
            />
          </View>
        )}
      </KeyboardAvoidingView>
      <Modal
        animationType="fade"
        onRequestClose={() => setImagePreview(null)}
        transparent
        visible={Boolean(imagePreview)}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewPanel}>
            <Pressable
              accessibilityLabel="Close image preview"
              accessibilityRole="button"
              onPress={() => setImagePreview(null)}
              style={({ pressed }) => [styles.previewClose, pressed && styles.smallPressed]}
            >
              <Ionicons color={colors.text} name="close" size={22} />
            </Pressable>
            <View style={styles.previewMedia}>
              {previewImageUri ? (
                <Image resizeMode="contain" source={{ uri: previewImageUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Ionicons color={colors.textSecondary} name="image-outline" size={42} />
                  <Text style={styles.previewPlaceholderText}>Preview is available on OpenX Desktop</Text>
                </View>
              )}
            </View>
            <View style={styles.previewCopy}>
              <Text numberOfLines={1} style={styles.previewTitle}>{imagePreview?.name || 'Photo Memory'}</Text>
              <Text numberOfLines={2} style={styles.previewMeta}>
                {[imagePreview?.location, imagePreview?.matchScore ? `${Math.round(imagePreview.matchScore)}% match` : '', imagePreview?.path].filter(Boolean).join(' - ')}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topLayer: {
    left: 0,
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
  },
  modeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeSlider: {
    flex: 1,
    minHeight: 54,
  },
  floatPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  connectionPill: {
    alignItems: 'center',
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderBright,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  connectionSpinner: {
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.round,
    borderRightColor: colors.text,
    borderTopColor: colors.text,
    borderWidth: 2,
    height: 22,
    position: 'absolute',
    width: 22,
  },
  connectionDot: {
    borderRadius: radius.round,
    height: 9,
    width: 9,
  },
  online: { backgroundColor: colors.success },
  offline: { backgroundColor: colors.danger },
  list: { flex: 1 },
  listContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
  },
  listContentRecovery: {
    justifyContent: 'center',
  },
  connectionCard: {
    ...shadows.card,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  connectionCardCompact: {
    marginBottom: spacing.md,
  },
  connectionCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  connectionCardIcon: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  connectionCardIcon_warning: {
    backgroundColor: 'rgba(246, 185, 74, 0.13)',
    borderColor: 'rgba(246, 185, 74, 0.30)',
  },
  connectionCardIcon_info: {
    backgroundColor: colors.glassSubtle,
    borderColor: colors.borderBright,
  },
  connectionCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  connectionCardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  connectionCardText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
  },
  connectionCardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  connectionPrimaryAction: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.round,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  connectionSecondaryAction: {
    alignItems: 'center',
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderBright,
    borderRadius: radius.round,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  connectionPrimaryText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '900',
  },
  connectionSecondaryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  assistantDock: {
    bottom: 0,
    gap: spacing.sm,
    left: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    position: 'absolute',
    right: 0,
    zIndex: 24,
  },
  actionDock: {
    bottom: 0,
    left: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    position: 'absolute',
    right: 0,
    zIndex: 24,
  },
  composer: {
    ...shadows.floating,
    alignItems: 'flex-end',
    borderColor: colors.borderBright,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    padding: 6,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.glassStrong,
    borderRadius: radius.round,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  inputStack: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  input: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 112,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.white,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  smallPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.94 }],
  },
  disabled: { opacity: 0.42 },
  fileChip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  filePreview: {
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    height: 34,
    width: 34,
  },
  fileIcon: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  fileText: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  fileSize: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  clearFile: {
    alignItems: 'center',
    borderRadius: radius.round,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  previewOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.68)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  previewPanel: {
    ...shadows.card,
    backgroundColor: colors.contentElevated,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    maxHeight: '82%',
    overflow: 'hidden',
    padding: spacing.md,
    width: '100%',
  },
  previewClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.lg,
    top: spacing.lg,
    width: 38,
    zIndex: 2,
  },
  previewMedia: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: colors.content,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  previewPlaceholder: {
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  previewPlaceholderText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  previewCopy: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.md,
  },
  previewTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  previewMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 4,
  },
});
