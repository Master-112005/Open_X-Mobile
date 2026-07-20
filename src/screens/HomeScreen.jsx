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
import SegmentedSlider from '../components/SegmentedSlider';
import { useApp } from '../context/AppContext';
import MobileChatPanel from './MobileChatPanel';
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
    sendMessage,
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

  return (
    <View style={styles.screen}>
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
                { paddingTop: topControlsHeight + spacing.md, paddingBottom: assistantDockHeight + spacing.xl },
              ]}
              data={messages}
              initialNumToRender={14}
              keyExtractor={keyMessage}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
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
        ) : (
          <MobileChatPanel
            bottomPadding={bottomActionHeight + spacing.sm}
            deviceName={deviceName}
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
                  color={colors.text}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
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
  assistantDock: {
    backgroundColor: colors.background,
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
    backgroundColor: colors.background,
    bottom: 0,
    left: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    position: 'absolute',
    right: 0,
    zIndex: 24,
  },
  composer: {
    ...shadows.card,
    alignItems: 'flex-end',
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    padding: 6,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
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
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
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
    backgroundColor: 'rgba(18,18,22,0.96)',
    borderColor: colors.border,
    borderRadius: 24,
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
    backgroundColor: colors.glassSubtle,
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
