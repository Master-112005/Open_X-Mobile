import { Ionicons } from '@expo/vector-icons';
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

function FileRow({ item }) {
  return (
    <GlassPanel style={styles.row} contentStyle={styles.rowContent}>
      <View style={styles.fileMark}>
        <Ionicons color={colors.text} name="document-outline" size={22} />
      </View>
      <View style={styles.fileCopy}>
        <Text numberOfLines={1} style={styles.fileName}>{item.fileName}</Text>
        <Text style={styles.fileMeta}>
          {formatFileSize(item.fileSize)} - {formatTimestamp(item.timestamp)}
        </Text>
        {item.error ? <Text numberOfLines={2} style={styles.errorText}>{item.error}</Text> : null}
      </View>
      <View style={[styles.statusDot, item.status === 'received' ? styles.received : styles.failed]} />
    </GlassPanel>
  );
}

export default function TransfersScreen({ navigation }) {
  const {
    clearTransferEvent,
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
          renderItem={({ item }) => <FileRow item={item} />}
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
  errorText: {
    color: colors.danger,
    fontSize: 11,
    marginTop: spacing.xs,
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
