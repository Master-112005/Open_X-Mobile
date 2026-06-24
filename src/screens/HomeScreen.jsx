import { useCallback, useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ChatBubble from '../components/ChatBubble';
import ConnectionStatus from '../components/ConnectionStatus';
import MessageInput from '../components/MessageInput';
import { useApp } from '../context/AppContext';
import { colors, spacing } from '../styles/theme';

export default function HomeScreen() {
  const {
    messages,
    connectionStatus,
    paired,
    pairingLoaded,
    permissions,
    permissionsLoaded,
    sessionLoaded,
    sessionValid,
    sendMessage,
  } = useApp();
  const listRef = useRef(null);

  const scrollToNewest = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const commandRestriction = !pairingLoaded || !paired
    ? 'Pair this device before sending commands.'
    : !permissionsLoaded
      ? 'Checking desktop permissions...'
      : !permissions.remoteCommands
        ? 'Remote commands disabled by desktop.'
        : !sessionLoaded
          ? 'Checking session...'
          : !sessionValid
            ? 'Session expired. Please reconnect.'
            : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ConnectionStatus status={connectionStatus} />
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>ASSISTANT</Text>
        <Text style={styles.title}>What can I help with?</Text>
      </View>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollToNewest}
        onLayout={scrollToNewest}
        ref={listRef}
        renderItem={({ item }) => <ChatBubble message={item} />}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
      <MessageInput
        disabled={Boolean(commandRestriction)}
        disabledMessage={commandRestriction}
        onSend={sendMessage}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  heading: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: spacing.xs,
  },
  list: { flex: 1 },
  listContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
});
