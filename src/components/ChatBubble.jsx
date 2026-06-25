import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';

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
      {!isUser && (
        <LinearGradient colors={[colors.primary, '#566ED8']} style={styles.avatar}>
          <Text style={styles.avatarText}>OX</Text>
        </LinearGradient>
      )}
      <LinearGradient
        colors={
          isUser
            ? ['#4F70E0', '#3957BD']
            : [colors.surfaceElevated, colors.assistantBubble]
        }
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[
          styles.content,
          isUser ? styles.userContent : styles.assistantContent,
        ]}
      >
        <Text style={styles.message}>{message.text}</Text>
        <Text style={[styles.time, isUser && styles.userTime]}>
          {formatTime(message.timestamp)}
        </Text>
      </LinearGradient>
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
  avatar: {
    ...shadows.glow,
    alignItems: 'center',
    borderRadius: radius.round,
    height: 32,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 32,
  },
  avatarText: { color: colors.white, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  content: {
    ...shadows.card,
    borderRadius: radius.md,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  userContent: { borderBottomRightRadius: 5 },
  assistantContent: {
    borderBottomLeftRadius: 5,
    borderColor: colors.border,
    borderWidth: 1,
  },
  message: { color: colors.text, fontSize: 15, lineHeight: 22 },
  time: { color: colors.textMuted, fontSize: 10, marginTop: 7 },
  userTime: { color: '#D6DFFF', textAlign: 'right' },
});
