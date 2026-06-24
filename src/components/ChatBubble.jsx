import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../styles/theme';

const formatTime = (timestamp) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));

export default function ChatBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>OX</Text>
        </View>
      )}
      <View
        style={[
          styles.content,
          isUser ? styles.userContent : styles.assistantContent,
        ]}
      >
        <Text style={styles.message}>{message.text}</Text>
        <Text style={[styles.time, isUser && styles.userTime]}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    marginBottom: spacing.lg,
    maxWidth: '88%',
  },
  userRow: { alignSelf: 'flex-end' },
  assistantRow: { alignSelf: 'flex-start' },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primaryMuted,
    borderColor: '#2E4380',
    borderRadius: radius.round,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 30,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  content: {
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  userContent: {
    backgroundColor: colors.userBubble,
    borderBottomRightRadius: 4,
  },
  assistantContent: {
    backgroundColor: colors.assistantBubble,
    borderBottomLeftRadius: 4,
    borderColor: colors.border,
    borderWidth: 1,
  },
  message: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  time: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 6,
  },
  userTime: { color: '#C6D4FF', textAlign: 'right' },
});
