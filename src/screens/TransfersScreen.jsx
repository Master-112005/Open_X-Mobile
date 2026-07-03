import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassPanel from '../components/GlassPanel';
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

function FileRow({ item, onManage }) {
  return (
    <Pressable
      accessibilityHint="Long press to share or delete this file"
      accessibilityLabel={`${item.fileName}. ${item.status}`}
      accessibilityRole="button"
      delayLongPress={260}
      onLongPress={() => onManage(item)}
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
            {item.status === 'received' ? 'Long press for share or delete' : 'Long press to delete'}
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
  } = useApp();
  const insets = useSafeAreaInsets();

  const receivedFiles = useMemo(
    () => transferHistory.filter((item) => item.direction === 'received'),
    [transferHistory],
  );

  useEffect(() => {
    if (!lastTransferEvent) return;
    Alert.alert(
      lastTransferEvent.type === 'success' ? 'File received' : 'Transfer error',
      lastTransferEvent.message,
    );
    clearTransferEvent();
  }, [clearTransferEvent, lastTransferEvent]);

  const shareFile = async (item) => {
    if (item.status !== 'received' || !item.localUri) {
      Alert.alert('File unavailable', 'This transfer does not have a saved file to share.');
      return;
    }

    const fileInfo = await FileSystem.getInfoAsync(item.localUri);
    if (!fileInfo.exists) {
      Alert.alert(
        'File missing',
        'This file is no longer in OpenX received storage.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              deleteReceivedFile(item.id).catch((error) => {
                Alert.alert('Remove failed', error.message);
              });
            },
          },
        ],
      );
      return;
    }

    const sharingAvailable = await Sharing.isAvailableAsync();
    if (!sharingAvailable) {
      Alert.alert('Sharing unavailable', 'This device does not support the native share sheet.');
      return;
    }

    await Sharing.shareAsync(item.localUri, {
      dialogTitle: item.fileName,
    });
  };

  const confirmDeleteFile = (item) => {
    Alert.alert(
      'Delete file?',
      item.status === 'received'
        ? `Delete ${item.fileName} from OpenX received files?`
        : `Remove ${item.fileName} from the transfer list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReceivedFile(item.id);
            } catch (error) {
              Alert.alert('Delete failed', error.message);
            }
          },
        },
      ],
    );
  };

  const manageFile = (item) => {
    const buttons = [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDeleteFile(item),
      },
    ];

    if (item.status === 'received' && item.localUri) {
      buttons.splice(1, 0, {
        text: 'Share',
        onPress: () => {
          shareFile(item).catch((error) => {
            Alert.alert('Share failed', error.message);
          });
        },
      });
    }

    Alert.alert(item.fileName, 'Manage this received file.', buttons);
  };

  return (
    <View style={styles.screen}>
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

      <View style={[styles.titleBlock, { paddingTop: insets.top + 88 }]}>
        <Text style={styles.title}>Files</Text>
      </View>

      {!transfersLoaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.xl }]}
          data={receivedFiles}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No received files yet.</Text>
            </View>
          }
          renderItem={({ item }) => <FileRow item={item} onManage={manageFile} />}
          showsVerticalScrollIndicator={false}
        />
      )}
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
});
