import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ConnectionStatus from '../components/ConnectionStatus';
import { useApp } from '../context/AppContext';
import { formatFileSize, pickTransferFile } from '../services/fileTransfer';
import { colors, radius, spacing } from '../styles/theme';

const formatTimestamp = (timestamp) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));

function TransferRow({ item, showDirection = true }) {
  const successful = item.status === 'sent' || item.status === 'received';

  return (
    <View style={styles.transferRow}>
      <View
        style={[
          styles.fileBadge,
          !successful && styles.fileBadgeFailed,
        ]}
      >
        <Text style={styles.fileBadgeText}>
          {item.direction === 'sent' ? '↑' : '↓'}
        </Text>
      </View>
      <View style={styles.transferCopy}>
        <Text numberOfLines={1} style={styles.transferName}>
          {item.fileName}
        </Text>
        <Text style={styles.transferMeta}>
          {formatFileSize(item.fileSize)} · {formatTimestamp(item.timestamp)}
        </Text>
        {item.error && (
          <Text numberOfLines={2} style={styles.transferError}>
            {item.error}
          </Text>
        )}
      </View>
      <View style={styles.transferStatusCopy}>
        {showDirection && (
          <Text style={styles.directionText}>
            {item.direction === 'sent' ? 'SENT' : 'RECEIVED'}
          </Text>
        )}
        <Text
          style={[
            styles.statusText,
            !successful && styles.statusTextFailed,
          ]}
        >
          {item.status.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

export default function TransfersScreen() {
  const {
    clearTransferEvent,
    connectionStatus,
    lastTransferEvent,
    paired,
    permissions,
    permissionsLoaded,
    sessionLoaded,
    sessionValid,
    sendFile,
    transferHistory,
    transfersLoaded,
  } = useApp();
  const [selectedFile, setSelectedFile] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [sending, setSending] = useState(false);

  const receivedFiles = useMemo(
    () =>
      transferHistory.filter(
        (item) => item.direction === 'received' && item.status === 'received',
      ),
    [transferHistory],
  );

  useEffect(() => {
    if (!lastTransferEvent) return;
    Alert.alert(
      lastTransferEvent.type === 'success'
        ? 'File received'
        : 'Transfer error',
      lastTransferEvent.message,
    );
    clearTransferEvent();
  }, [clearTransferEvent, lastTransferEvent]);

  const handleSelectFile = async () => {
    if (
      !paired ||
      !permissions.fileTransfer ||
      !permissions.sendFiles ||
      !sessionValid
    ) {
      return;
    }
    setSelecting(true);
    try {
      const file = await pickTransferFile();
      if (file) setSelectedFile(file);
    } catch (error) {
      Alert.alert('Unable to select file', error.message);
    } finally {
      setSelecting(false);
    }
  };

  const handleSendFile = async () => {
    if (!selectedFile || sending) return;
    setSending(true);
    try {
      await sendFile(selectedFile);
      Alert.alert('Transfer complete', `${selectedFile.fileName} was sent.`);
      setSelectedFile(null);
    } catch (error) {
      Alert.alert('Transfer failed', error.message);
    } finally {
      setSending(false);
    }
  };

  const transferAllowed =
    paired &&
    permissionsLoaded &&
    permissions.fileTransfer &&
    sessionLoaded &&
    sessionValid;
  const sendAllowed = transferAllowed && permissions.sendFiles;
  const canSend = sendAllowed && selectedFile && !sending && !selecting;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.container}
    >
      <ConnectionStatus status={connectionStatus} />

      <View style={styles.heading}>
        <Text style={styles.eyebrow}>FILE TRANSFER</Text>
        <Text style={styles.title}>Transfers</Text>
        <Text style={styles.subtitle}>
          Send files over your paired local OpenX connection. Maximum file size
          is 100 MB.
        </Text>
      </View>

      {!paired && (
        <View style={styles.restrictionBanner}>
          <Text style={styles.restrictionText}>
            Pair device before transferring files.
          </Text>
        </View>
      )}

      {paired && permissionsLoaded && !permissions.fileTransfer && (
        <View style={styles.restrictionBanner}>
          <Text style={styles.restrictionText}>
            File transfers disabled by desktop.
          </Text>
        </View>
      )}

      {paired && permissionsLoaded && permissions.fileTransfer && !permissions.sendFiles && (
        <View style={styles.restrictionBanner}>
          <Text style={styles.restrictionText}>
            Sending files disabled by desktop.
          </Text>
        </View>
      )}

      {paired && !permissionsLoaded && (
        <View style={styles.restrictionBanner}>
          <Text style={styles.restrictionText}>
            Checking desktop permissions...
          </Text>
        </View>
      )}

      {paired &&
        permissionsLoaded &&
        permissions.fileTransfer &&
        sessionLoaded &&
        !sessionValid && (
          <View style={styles.restrictionBanner}>
            <Text style={styles.restrictionText}>
              Session expired. Please reconnect.
            </Text>
          </View>
        )}

      {paired &&
        permissionsLoaded &&
        permissions.fileTransfer &&
        !sessionLoaded && (
          <View style={styles.restrictionBanner}>
            <Text style={styles.restrictionText}>Checking session...</Text>
          </View>
        )}

      <Text style={styles.sectionTitle}>Send File</Text>
      <View style={styles.card}>
        {selectedFile ? (
          <View style={styles.selectedFile}>
            <View style={styles.selectedIcon}>
              <Text style={styles.selectedIconText}>FILE</Text>
            </View>
            <View style={styles.selectedCopy}>
              <Text numberOfLines={1} style={styles.selectedName}>
                {selectedFile.fileName}
              </Text>
              <Text style={styles.selectedSize}>
                {formatFileSize(selectedFile.fileSize)}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Remove selected file"
              accessibilityRole="button"
              disabled={sending}
              onPress={() => setSelectedFile(null)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.emptySelection}>No file selected</Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={!sendAllowed || selecting || sending}
          onPress={handleSelectFile}
          style={({ pressed }) => [
            styles.secondaryButton,
            (!sendAllowed || selecting || sending) && styles.buttonDisabled,
            pressed && sendAllowed && styles.secondaryButtonPressed,
          ]}
        >
          {selecting ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.secondaryButtonText}>Select File</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={!canSend}
          onPress={handleSendFile}
          style={({ pressed }) => [
            styles.primaryButton,
            !canSend && styles.buttonDisabled,
            pressed && canSend && styles.primaryButtonPressed,
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Send To OpenX</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Received Files</Text>
      {paired && permissionsLoaded && permissions.fileTransfer && !permissions.receiveFiles && (
        <View style={styles.sectionRestriction}>
          <Text style={styles.sectionRestrictionText}>
            Receiving files disabled by desktop.
          </Text>
        </View>
      )}
      <View style={styles.listCard}>
        {!transfersLoaded ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : receivedFiles.length ? (
          receivedFiles.slice(0, 5).map((item) => (
            <TransferRow item={item} key={item.id} showDirection={false} />
          ))
        ) : (
          <Text style={styles.emptyText}>No files received yet.</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Transfer History</Text>
      <View style={styles.listCard}>
        {!transfersLoaded ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : transferHistory.length ? (
          transferHistory.map((item) => <TransferRow item={item} key={item.id} />)
        ) : (
          <Text style={styles.emptyText}>No transfer history yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { paddingBottom: spacing.xxl },
  heading: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
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
  restrictionBanner: {
    backgroundColor: '#332718',
    borderColor: '#725429',
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  restrictionText: {
    color: '#F6C66F',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionRestriction: {
    backgroundColor: '#332718',
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.sm,
  },
  sectionRestrictionText: {
    color: '#F6C66F',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
  },
  emptySelection: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  selectedFile: { alignItems: 'center', flexDirection: 'row' },
  selectedIcon: {
    alignItems: 'center',
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.sm,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  selectedIconText: { color: colors.primary, fontSize: 8, fontWeight: '800' },
  selectedCopy: { flex: 1, marginHorizontal: spacing.md },
  selectedName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  selectedSize: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs },
  removeButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  removeText: { color: colors.textSecondary, fontSize: 24 },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryMuted,
    borderColor: '#3854A0',
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  secondaryButtonPressed: { backgroundColor: '#24376D' },
  secondaryButtonText: { color: '#B9C8FF', fontSize: 14, fontWeight: '700' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    height: 48,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  primaryButtonPressed: { backgroundColor: colors.primaryPressed },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  listCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  loader: { margin: spacing.xl },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    padding: spacing.xl,
    textAlign: 'center',
  },
  transferRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    padding: spacing.md,
  },
  fileBadge: {
    alignItems: 'center',
    backgroundColor: '#112D24',
    borderRadius: radius.sm,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  fileBadgeFailed: { backgroundColor: '#351D25' },
  fileBadgeText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  transferCopy: { flex: 1, marginHorizontal: spacing.md },
  transferName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  transferMeta: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
  transferError: { color: '#F1848D', fontSize: 10, marginTop: 3 },
  transferStatusCopy: { alignItems: 'flex-end' },
  directionText: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  statusText: {
    color: colors.success,
    fontSize: 8,
    fontWeight: '800',
    marginTop: 3,
  },
  statusTextFailed: { color: colors.danger },
});
