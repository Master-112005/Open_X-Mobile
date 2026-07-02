import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing } from '../styles/theme';

const formatTime = (timestamp) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));

export default function ChatBubble({ message }) {
  const isUser = message.role === 'user';
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
});
