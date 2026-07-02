import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing } from '../styles/theme';

const formatTime = (timestamp) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));

function normalizeResultEntries(message) {
  const intent = String(message?.intent || '');
  if (intent === 'browser.search') {
    const sources = Array.isArray(message?.data?.searchSummary?.sources)
      ? message.data.searchSummary.sources
      : (Array.isArray(message?.data?.results) ? message.data.results : []);
    return sources.slice(0, 4).map((entry, index) => ({
      index: index + 1,
      name: String(entry?.title || entry?.sourceDomain || `Source ${index + 1}`),
      type: 'web',
      path: String(entry?.url || ''),
      location: String(entry?.sourceDomain || ''),
      snippet: String(entry?.snippet || ''),
      matchScore: Number(entry?.score || 0),
    }));
  }

  if (!['file.search', 'folder.search', 'file.smartFind', 'file.list'].includes(intent)) {
    return [];
  }

  const entries = Array.isArray(message?.data?.entries) ? message.data.entries : [];
  return entries.slice(0, 6).map((entry, index) => ({
    index: index + 1,
    name: String(entry?.name || entry?.path?.split(/[\\/]/).filter(Boolean).pop() || `Result ${index + 1}`),
    type: String(entry?.type || (intent === 'folder.search' ? 'folder' : 'file')),
    path: String(entry?.path || ''),
    location: String(entry?.location || ''),
    sizeMB: Number(entry?.sizeMB || 0),
    matchScore: Number(entry?.matchScore || 0),
  }));
}

function ResultCards({ entries }) {
  if (!entries.length) return null;
  return (
    <View style={styles.resultList}>
      {entries.map((entry) => (
        <View key={`${entry.index}-${entry.path || entry.name}`} style={styles.resultCard}>
          <Text style={styles.resultKind}>{entry.type === 'folder' ? 'Folder' : entry.type === 'web' ? 'Web' : 'File'}</Text>
          <View style={styles.resultCopy}>
            <Text numberOfLines={1} style={styles.resultName}>{entry.name}</Text>
            {entry.snippet ? <Text numberOfLines={2} style={styles.resultMeta}>{entry.snippet}</Text> : null}
            <Text numberOfLines={2} style={styles.resultMeta}>
              {[entry.location, entry.sizeMB > 0 ? `${entry.sizeMB} MB` : '', entry.matchScore > 0 && entry.type !== 'web' ? `${Math.round(entry.matchScore)}% match` : '', entry.path].filter(Boolean).join(' - ')}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ChoiceCards({ choices, onChoice }) {
  if (!choices.length) return null;
  return (
    <View style={styles.choiceList}>
      {choices.slice(0, 8).map((choice, index) => {
        const choiceIndex = Number(choice.index) || index + 1;
        const choicePath = String(choice.path || '');
        const fallbackTitle = String(choice.title || `Option ${choiceIndex}`);
        const choiceName = choicePath.split(/[\\/]/).filter(Boolean).pop() ||
          fallbackTitle.replace(/\s+-\s+[A-Za-z]:\\.*$/, '') ||
          `Option ${choiceIndex}`;
        return (
          <Pressable
            accessibilityLabel={`Choose option ${choiceIndex}`}
            accessibilityRole="button"
            key={`${choiceIndex}-${choicePath || choiceName}`}
            onPress={() => onChoice?.(String(choiceIndex))}
            style={({ pressed }) => [styles.choiceCard, pressed && styles.choicePressed]}
          >
            <Text style={styles.choiceNumber}>{choiceIndex}</Text>
            <View style={styles.choiceCopy}>
              <Text numberOfLines={1} style={styles.choiceName}>{choiceName}</Text>
              {choicePath ? <Text numberOfLines={2} style={styles.choicePath}>{choicePath}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ChatBubble({ message, onChoice }) {
  const isUser = message.role === 'user';
  const resultEntries = !isUser ? normalizeResultEntries(message) : [];
  const choices = !isUser && Array.isArray(message.choices) ? message.choices : [];
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active || reduceMotion) {
        opacity.setValue(1);
        translateY.setValue(0);
        return;
      }
      Animated.parallel([
        Animated.timing(opacity, {
          duration: 260,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          damping: 18,
          mass: 0.7,
          stiffness: 180,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => {
      active = false;
    };
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.row,
        isUser ? styles.userRow : styles.assistantRow,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <View
        style={[
          styles.content,
          isUser ? styles.userContent : styles.assistantContent,
        ]}
      >
        <Text style={styles.message}>{message.text}</Text>
        <ResultCards entries={resultEntries} />
        <ChoiceCards choices={choices} onChoice={onChoice} />
        <Text style={[styles.time, isUser && styles.userTime]}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    marginBottom: spacing.lg,
    maxWidth: '90%',
  },
  userRow: { alignSelf: 'flex-end' },
  assistantRow: { alignSelf: 'flex-start' },
  content: {
    ...shadows.card,
    backgroundColor: colors.glass,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  userContent: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderBottomRightRadius: 8,
  },
  assistantContent: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 8,
  },
  message: { color: colors.text, fontSize: 15, lineHeight: 22 },
  time: { color: colors.textMuted, fontSize: 10, marginTop: 7 },
  userTime: { color: colors.textSecondary, textAlign: 'right' },
  resultList: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  resultCard: {
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  resultKind: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '900',
    width: 44,
  },
  resultCopy: { flex: 1 },
  resultName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  resultMeta: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
  choiceList: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  choiceCard: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    padding: spacing.sm,
  },
  choicePressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  choiceNumber: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    width: 28,
  },
  choiceCopy: { flex: 1 },
  choiceName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  choicePath: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
});
