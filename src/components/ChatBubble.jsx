import { memo, useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing } from '../styles/theme';

const formatTime = (timestamp) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));

const VISUAL_RESULT_KEYS = [
  'visualResults',
  'memories',
  'photos',
  'images',
  'matches',
  'people',
  'collections',
  'resultEntries',
  'entries',
  'results',
];
const VISUAL_SPECIFIC_RESULT_KEYS = VISUAL_RESULT_KEYS.filter(
  (key) => !['resultEntries', 'entries', 'results'].includes(key),
);
const RECENT_MESSAGE_ANIMATION_MS = 10000;
let reduceMotionPromise = null;

const getReduceMotionPreference = () => {
  if (!reduceMotionPromise) {
    reduceMotionPromise = AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
  }
  return reduceMotionPromise;
};

const getLeafName = (value) =>
  String(value || '').split(/[\\/]/).filter(Boolean).pop() || '';

const getFirstArray = (source, keys) => {
  if (!source || typeof source !== 'object') return [];
  for (const key of keys) {
    if (Array.isArray(source[key])) return source[key];
  }
  return [];
};

const isVisualPayload = (intent, data) => {
  const normalizedIntent = String(intent || '').toLowerCase();
  if (/(?:visual|gallery|photo|photos|image|memory|memories|people|face)/.test(normalizedIntent)) {
    return true;
  }
  return VISUAL_SPECIFIC_RESULT_KEYS.some((key) => Array.isArray(data?.[key]));
};

const normalizeVisualLabel = (entry, index) =>
  String(
    entry?.title ||
    entry?.name ||
    entry?.label ||
    entry?.caption ||
    entry?.memoryTitle ||
    entry?.fileName ||
    getLeafName(entry?.path || entry?.uri || entry?.url) ||
    `Memory ${index + 1}`,
  );

const formatScore = (value) => {
  const score = Number(value);
  if (!Number.isFinite(score) || score <= 0) return '';
  return `${Math.round(score <= 1 ? score * 100 : score)}% match`;
};

const getResultKindLabel = (type) => {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'folder') return 'Folder';
  if (normalized === 'web') return 'Web';
  if (normalized === 'person' || normalized === 'face') return 'Person';
  if (normalized === 'collection') return 'Set';
  if (normalized === 'memory') return 'Memory';
  if (normalized === 'photo' || normalized === 'image') return 'Photo';
  return 'File';
};

const isPreviewableResult = (entry) =>
  ['photo', 'image', 'memory', 'person', 'face'].includes(String(entry?.type || '').toLowerCase());

const visualImageUri = (entry = {}) => {
  const source = String(entry.thumbnailUri || entry.thumbnailUrl || entry.imageUri || entry.imageUrl || entry.src || entry.uri || '');
  return /^(?:https?:|file:|content:|data:image\/)/i.test(source) ? source : '';
};

function normalizeResultEntries(message) {
  const intent = String(message?.intent || '');
  const data = message?.data && typeof message.data === 'object' ? message.data : {};
  if (intent === 'browser.search') {
    const sources = Array.isArray(data?.searchSummary?.sources)
      ? message.data.searchSummary.sources
      : (Array.isArray(data?.results) ? data.results : []);
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

  if (isVisualPayload(intent, data)) {
    const entries = getFirstArray(data, VISUAL_RESULT_KEYS);
    return entries.slice(0, 10).map((entry, index) => {
      const people = Array.isArray(entry?.people)
        ? entry.people.map((person) => String(person?.name || person?.label || person)).filter(Boolean).slice(0, 3).join(', ')
        : String(entry?.personName || entry?.relationship || '');
      const objects = Array.isArray(entry?.objects)
        ? entry.objects.map((object) => String(object?.name || object?.label || object)).filter(Boolean).slice(0, 4).join(', ')
        : '';
      const location = String(entry?.location || entry?.place || entry?.city || '');
      const detail = [
        String(entry?.event || entry?.scene || entry?.collection || ''),
        people,
        objects,
      ].filter(Boolean).join(' - ');
      return {
        index: index + 1,
        photoId: String(entry?.photoId || entry?.id || ''),
        name: normalizeVisualLabel(entry, index),
        type: String(entry?.type || entry?.kind || (people ? 'person' : 'photo')),
        path: String(entry?.path || entry?.uri || entry?.url || ''),
        imageUri: visualImageUri(entry),
        location,
        snippet: String(entry?.summary || entry?.description || entry?.ocrText || ''),
        detail,
        matchScore: Number(entry?.matchScore || entry?.confidence || entry?.score || entry?.rankingScore || 0),
      };
    });
  }

  if (!['file.search', 'folder.search', 'file.smartFind', 'file.list'].includes(intent)) {
    return [];
  }

  const entries = Array.isArray(data?.entries) ? data.entries : [];
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

function ResultCards({ entries, onPreview, visual }) {
  if (!entries.length) return null;
  if (visual) {
    return (
      <ScrollView
        contentContainerStyle={styles.visualResultStrip}
        horizontal
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.visualResultViewport}
      >
        {entries.slice(0, 10).map((entry) => (
          <Pressable
            accessibilityLabel={`Preview ${entry.name}`}
            accessibilityRole="button"
            key={`${entry.index}-${entry.photoId || entry.path || entry.name}`}
            onPress={() => onPreview?.(entry)}
            style={({ pressed }) => [styles.visualResultCard, pressed && styles.choicePressed]}
          >
            <View style={styles.visualThumb}>
              {entry.imageUri ? (
                <Image resizeMode="cover" source={{ uri: entry.imageUri }} style={styles.visualThumbImage} />
              ) : (
                <Text style={styles.visualThumbFallback}>IMG</Text>
              )}
            </View>
            <View style={styles.visualCopy}>
              <Text numberOfLines={1} style={styles.visualName}>{entry.name}</Text>
              <Text numberOfLines={1} style={styles.visualMeta}>
                {[entry.type, formatScore(entry.matchScore)].filter(Boolean).join(' - ') || 'Possible match'}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    );
  }
  return (
    <View style={styles.resultList}>
      {entries.map((entry) => {
        const content = (
          <>
            <Text style={styles.resultKind}>{getResultKindLabel(entry.type)}</Text>
            <View style={styles.resultCopy}>
              <Text numberOfLines={1} style={styles.resultName}>{entry.name}</Text>
              {entry.snippet ? <Text numberOfLines={2} style={styles.resultMeta}>{entry.snippet}</Text> : null}
              {entry.detail ? <Text numberOfLines={2} style={styles.resultMeta}>{entry.detail}</Text> : null}
              <Text numberOfLines={2} style={styles.resultMeta}>
                {[entry.location, entry.sizeMB > 0 ? `${entry.sizeMB} MB` : '', entry.type !== 'web' ? formatScore(entry.matchScore) : '', entry.path].filter(Boolean).join(' - ')}
              </Text>
            </View>
          </>
        );
        return isPreviewableResult(entry) ? (
          <Pressable
            accessibilityLabel={`Preview ${entry.name}`}
            accessibilityRole="button"
            key={`${entry.index}-${entry.photoId || entry.path || entry.name}`}
            onPress={() => onPreview?.(entry)}
            style={({ pressed }) => [styles.resultCard, styles.resultCardPressable, pressed && styles.choicePressed]}
          >
            {content}
          </Pressable>
        ) : (
          <View key={`${entry.index}-${entry.path || entry.name}`} style={styles.resultCard}>
            {content}
          </View>
        );
      })}
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

function ChatBubble({ message, onChoice, onPreview }) {
  const isUser = message.role === 'user';
  const resultEntries = useMemo(() => (!isUser ? normalizeResultEntries(message) : []), [isUser, message]);
  const visualResults = !isUser && isVisualPayload(message?.intent, message?.data);
  const choices = !isUser && Array.isArray(message.choices) ? message.choices : [];
  const shouldAnimate = useRef(Date.now() - new Date(message.timestamp || Date.now()).getTime() < RECENT_MESSAGE_ANIMATION_MS).current;
  const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(shouldAnimate ? 8 : 0)).current;

  useEffect(() => {
    if (!shouldAnimate) return undefined;
    let active = true;
    getReduceMotionPreference().then((reduceMotion) => {
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
  }, [opacity, shouldAnimate, translateY]);

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
        <Text style={[styles.message, isUser && styles.userMessage]}>{message.text}</Text>
        <ResultCards entries={resultEntries} onPreview={onPreview} visual={visualResults} />
        <ChoiceCards choices={choices} onChoice={onChoice} />
        <Text style={[styles.time, isUser && styles.userTime]}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </Animated.View>
  );
}

export default memo(ChatBubble);

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
    backgroundColor: colors.content,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    maxWidth: '100%',
    minWidth: 0,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  userContent: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomRightRadius: 11,
  },
  assistantContent: {
    backgroundColor: colors.contentElevated,
    borderBottomLeftRadius: 11,
  },
  message: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  userMessage: {
    color: colors.background,
  },
  time: { color: colors.textMuted, fontSize: 10, marginTop: 7 },
  userTime: { color: 'rgba(3,5,10,0.5)', textAlign: 'right' },
  resultList: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  visualResultStrip: {
    gap: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
  },
  visualResultViewport: {
    marginTop: spacing.md,
    maxWidth: '100%',
  },
  visualResultCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    width: 142,
  },
  visualThumb: {
    alignItems: 'center',
    aspectRatio: 4 / 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    width: '100%',
  },
  visualThumbImage: {
    height: '100%',
    width: '100%',
  },
  visualThumbFallback: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
  },
  visualCopy: {
    gap: 3,
    padding: spacing.sm,
  },
  visualName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  visualMeta: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  resultCardPressable: {
    minHeight: 56,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
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
