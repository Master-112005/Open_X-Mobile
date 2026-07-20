import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassPanel from '../components/GlassPanel';
import MobileBottomDock, { getMobileBottomDockHeight } from '../components/MobileBottomDock';
import { useApp } from '../context/AppContext';
import { formatFileSize } from '../services/fileTransfer';
import { colors, radius, spacing } from '../styles/theme';

const formatTimestamp = (timestamp) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));

function FileRow({ item, onManage, onOpen }) {
  return (
    <Pressable
      accessibilityHint="Tap to open. Long press to share or delete this file"
      accessibilityLabel={`${item.fileName}. ${item.status}`}
      accessibilityRole="button"
      delayLongPress={260}
      onLongPress={() => onManage(item)}
      onPress={() => onOpen(item)}
      style={({ pressed }) => [styles.rowPressable, pressed && styles.pressed]}
    >
      <GlassPanel style={styles.row} contentStyle={styles.rowContent}>
        <View style={styles.fileMark}>
          <Ionicons color={colors.text} name="document-outline" size={22} />
        </View>
        <View style={styles.fileCopy}>
          <Text numberOfLines={1} style={styles.fileName}>{item.fileName}</Text>
          <Text style={styles.fileMeta}>
            {formatFileSize(item.fileSize)} - {formatTimestamp(item.timestamp)}
          </Text>
          <Text style={styles.fileHint}>
            {item.status === 'received' ? 'Tap to open - Long press for options' : 'Long press to delete'}
          </Text>
          {item.error ? <Text numberOfLines={2} style={styles.errorText}>{item.error}</Text> : null}
        </View>
        <View style={styles.rowActions}>
          <Ionicons color={colors.textMuted} name="ellipsis-horizontal" size={18} />
          <View style={[styles.statusDot, item.status === 'received' ? styles.received : styles.failed]} />
        </View>
      </GlassPanel>
    </Pressable>
  );
}

export default function TransfersScreen({ navigation }) {
  const {
    clearTransferEvent,
    deleteReceivedFile,
    lastTransferEvent,
    transferHistory,
    transfersLoaded,
    showNotice,
  } = useApp();
  const insets = useSafeAreaInsets();
  const bottomDockHeight = getMobileBottomDockHeight(insets);
  const [managedFile, setManagedFile] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const receivedFiles = useMemo(
    () => transferHistory.filter((item) => item.direction === 'received'),
    [transferHistory],
  );

  useEffect(() => {
    if (!lastTransferEvent) return;
    showNotice({
      title: lastTransferEvent.type === 'success' ? 'File received' : 'Transfer error',
      message: lastTransferEvent.message,
      tone: lastTransferEvent.type === 'success' ? 'success' : 'error',
    });
    clearTransferEvent();
  }, [clearTransferEvent, lastTransferEvent, showNotice]);

  const shareFile = async (item) => {
    if (item.status !== 'received' || !item.localUri) {
      showNotice({ title: 'File unavailable', message: 'This transfer does not have a saved file to share.', tone: 'warning' });
      return;
    }

    const fileInfo = await FileSystem.getInfoAsync(item.localUri);
    if (!fileInfo.exists) {
      showNotice({
        title: 'File missing',
        message: 'This file is no longer in OpenX received storage.',
        tone: 'warning',
        actions: [
          { label: 'Cancel' },
          {
            label: 'Remove',
            tone: 'danger',
            onPress: () => {
              deleteReceivedFile(item.id).catch((error) => {
                showNotice({ title: 'Remove failed', message: error.message, tone: 'error' });
              });
            },
          },
        ],
      });
      return;
    }

    const sharingAvailable = await Sharing.isAvailableAsync();
    if (!sharingAvailable) {
      showNotice({ title: 'Sharing unavailable', message: 'This device does not support the native share sheet.', tone: 'warning' });
      return;
    }

    await Sharing.shareAsync(item.localUri, {
      dialogTitle: item.fileName,
    });
  };

  const openFile = async (item) => {
    if (item.status !== 'received' || !item.localUri) {
      setManagedFile(item);
      setConfirmingDelete(false);
      return;
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(item.localUri);
      if (!fileInfo.exists) {
        showNotice({ title: 'File missing', message: 'This file is no longer in OpenX received storage.', tone: 'warning' });
        return;
      }
      const openUri = Platform.OS === 'android' && typeof FileSystem.getContentUriAsync === 'function'
        ? await FileSystem.getContentUriAsync(item.localUri)
        : item.localUri;
      const supported = await Linking.canOpenURL(openUri);
      if (supported) {
        await Linking.openURL(openUri);
        closeManageSheet();
        return;
      }
      await shareFile(item);
      closeManageSheet();
    } catch (error) {
      showNotice({ title: 'Open failed', message: error.message || 'Unable to open this file.', tone: 'error' });
    }
  };

  const manageFile = (item) => {
    setManagedFile(item);
    setConfirmingDelete(false);
  };

  const closeManageSheet = () => {
    setManagedFile(null);
    setConfirmingDelete(false);
  };

  const deleteManagedFile = async () => {
    if (!managedFile) return;
    try {
      await deleteReceivedFile(managedFile.id);
      closeManageSheet();
    } catch (error) {
      showNotice({ title: 'Delete failed', message: error.message, tone: 'error' });
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.titleBlock, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.title}>Files</Text>
      </View>

      {!transfersLoaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomDockHeight + spacing.xl }]}
          data={receivedFiles}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No received files yet.</Text>
            </View>
          }
          renderItem={({ item }) => <FileRow item={item} onManage={manageFile} onOpen={openFile} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        animationType="fade"
        onRequestClose={closeManageSheet}
        transparent
        visible={Boolean(managedFile)}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeManageSheet}>
          <Pressable style={styles.sheetCard} onPress={(event) => event.stopPropagation?.()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetIcon}>
                <Ionicons color={colors.text} name="document-outline" size={22} />
              </View>
              <View style={styles.sheetCopy}>
                <Text numberOfLines={1} style={styles.sheetTitle}>{managedFile?.fileName}</Text>
                <Text style={styles.sheetMeta}>
                  {managedFile ? `${formatFileSize(managedFile.fileSize)} - ${managedFile.status}` : ''}
                </Text>
              </View>
            </View>

            {confirmingDelete ? (
              <>
                <Text style={styles.sheetMessage}>
                  {managedFile?.status === 'received'
                    ? 'Delete this file from OpenX received storage?'
                    : 'Remove this transfer from the list?'}
                </Text>
                <View style={styles.sheetActions}>
                  <Pressable style={styles.sheetButton} onPress={() => setConfirmingDelete(false)}>
                    <Ionicons color={colors.text} name="arrow-back" size={18} />
                    <Text style={styles.sheetButtonText}>Back</Text>
                  </Pressable>
                  <Pressable style={[styles.sheetButton, styles.dangerAction]} onPress={deleteManagedFile}>
                    <Ionicons color={colors.danger} name="trash-outline" size={18} />
                    <Text style={[styles.sheetButtonText, styles.dangerText]}>Delete</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.sheetActions}>
                {managedFile?.status === 'received' && managedFile?.localUri ? (
                  <>
                    <Pressable style={styles.sheetButton} onPress={() => openFile(managedFile)}>
                      <Ionicons color={colors.text} name="open-outline" size={18} />
                      <Text style={styles.sheetButtonText}>Open</Text>
                    </Pressable>
                    <Pressable
                      style={styles.sheetButton}
                      onPress={async () => {
                        try {
                          await shareFile(managedFile);
                          closeManageSheet();
                        } catch (error) {
                          showNotice({ title: 'Share failed', message: error.message, tone: 'error' });
                        }
                      }}
                    >
                      <Ionicons color={colors.text} name="share-outline" size={18} />
                      <Text style={styles.sheetButtonText}>Share</Text>
                    </Pressable>
                  </>
                ) : null}
                <Pressable style={[styles.sheetButton, styles.dangerAction]} onPress={() => setConfirmingDelete(true)}>
                  <Ionicons color={colors.danger} name="trash-outline" size={18} />
                  <Text style={[styles.sheetButtonText, styles.dangerText]}>Delete</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      <MobileBottomDock
        activeRoute="Transfers"
        navigation={navigation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  titleBlock: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  row: {
    borderRadius: radius.lg,
  },
  rowPressable: {
    borderRadius: radius.lg,
  },
  rowContent: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 72,
    padding: spacing.md,
  },
  fileMark: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  fileCopy: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  fileName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  fileMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  fileHint: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.danger,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  rowActions: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    borderRadius: radius.round,
    height: 10,
    width: 10,
  },
  received: { backgroundColor: colors.success },
  failed: { backgroundColor: colors.danger },
  empty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 360,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  sheetOverlay: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  sheetCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    padding: spacing.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: colors.borderBright,
    borderRadius: radius.round,
    height: 4,
    marginBottom: spacing.lg,
    width: 42,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  sheetIcon: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  sheetCopy: {
    flex: 1,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sheetMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  sheetMessage: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.lg,
  },
  sheetActions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  sheetButton: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  sheetButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  dangerAction: {
    backgroundColor: 'rgba(255,102,117,0.1)',
    borderColor: 'rgba(255,102,117,0.28)',
  },
  dangerText: {
    color: colors.danger,
  },
});
