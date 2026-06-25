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
import FadeInView from '../components/FadeInView';
import MessageInput from '../components/MessageInput';
import ScreenBackground from '../components/ScreenBackground';
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
    <ScreenBackground>
      <FadeInView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <ConnectionStatus status={connectionStatus} />
          <View style={styles.heading}>
            <View style={styles.eyebrowChip}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrow}>OPENX ASSISTANT</Text>
            </View>
            <Text style={styles.title}>What can I help with?</Text>
            <Text style={styles.subtitle}>Your desktop, one message away.</Text>
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
      </FadeInView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  eyebrowChip: { alignItems: 'center', flexDirection: 'row' },
  eyebrowDot: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 6,
    marginRight: spacing.sm,
    width: 6,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: spacing.sm,
  },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  list: { flex: 1 },
  listContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
});
