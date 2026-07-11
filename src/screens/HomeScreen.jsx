import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ChatBubble from '../components/ChatBubble';
import { useApp } from '../context/AppContext';
import { formatFileSize, pickTransferFile } from '../services/fileTransfer';
import { colors, gradients, radius, shadows, spacing } from '../styles/theme';

function FloatingButton({ iconName, label, onPress, accessibilityLabel }) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.floatButton, pressed && styles.floatPressed]}
    >
      <LinearGradient colors={gradients.glass} style={styles.floatGlass}>
        <Ionicons color={colors.text} name={iconName} size={22} />
      </LinearGradient>
    </Pressable>
  );
}

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
  const [selectingFile, setSelectingFile] = useState(false);
  const [sendingFile, setSendingFile] = useState(false);
  const listRef = useRef(null);
  const insets = useSafeAreaInsets();
  const topControlsHeight = insets.top + spacing.sm + 58 + spacing.lg;
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

  const canSendText = !commandRestriction && text.trim().length > 0;
  const canSendFile = connectionMode === 'cloud'
    ? paired && cloudStatus?.connected
    : paired &&
      permissionsLoaded &&
      permissions.fileTransfer &&
      permissions.sendFiles &&
      sessionLoaded &&
      sessionValid;

  const composerHint = useMemo(() => {
    if (selectedFile) return selectedFile.fileName;
    return commandRestriction || 'Message OpenX';
  }, [commandRestriction, selectedFile]);

  const scrollToNewest = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const handlePickFile = async () => {
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
  };

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
          <LinearGradient colors={gradients.glass} style={styles.topControlBar} pointerEvents="auto">
            <View style={styles.leftCluster}>
              <FloatingButton
                accessibilityLabel="Open received files"
                iconName="folder-open-outline"
                label="Files"
                onPress={() => navigation.navigate('Transfers')}
              />
              <ConnectionDot status={activeConnectionStatus} onReconnect={handleReconnect} />
            </View>
            <View style={styles.rightCluster}>
              <FloatingButton
                accessibilityLabel="Open calendar"
                iconName="calendar-outline"
                label="Calendar"
                onPress={() => navigation.navigate('Calendar')}
              />
              <FloatingButton
                accessibilityLabel="Open QR scanner"
                iconName="qr-code-outline"
                label="QR scanner"
                onPress={() => navigation.navigate('QRPairing')}
              />
              <FloatingButton
                accessibilityLabel="Open profile"
                iconName="person-circle-outline"
                label="Profile"
                onPress={() => navigation.navigate('Profile')}
              />
              <FloatingButton
                accessibilityLabel="Open settings"
                iconName="settings-outline"
                label="Settings"
                onPress={() => navigation.navigate('Settings')}
              />
            </View>
          </LinearGradient>
        </View>

        <FlatList
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: topControlsHeight + spacing.md, paddingBottom: spacing.xl },
          ]}
          data={messages}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToNewest}
          onLayout={scrollToNewest}
          ref={listRef}
          renderItem={({ item }) => <ChatBubble message={item} onChoice={handleChoice} />}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />

        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
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
                  <Text numberOfLines={1} style={styles.fileName}>{selectedFile.fileName}</Text>
                  <Text style={styles.fileSize}>{formatFileSize(selectedFile.fileSize)}</Text>
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
                  editable={!commandRestriction}
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
        </View>
      </KeyboardAvoidingView>
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
  topControlBar: {
    ...shadows.card,
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    padding: 5,
  },
  leftCluster: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rightCluster: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  floatButton: {
    borderRadius: radius.round,
    height: 46,
    overflow: 'hidden',
    width: 46,
  },
  floatGlass: {
    ...shadows.card,
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
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
  composerWrap: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
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
  fileName: {
    color: colors.text,
    flex: 1,
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
});
