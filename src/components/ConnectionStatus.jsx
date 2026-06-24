import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../styles/theme';

export default function ConnectionStatus({ status }) {
  const statusPresentation = {
    connecting: { label: 'Connecting', color: '#F6B94A' },
    connected: { label: 'Connected', color: colors.success },
    disconnected: { label: 'Disconnected', color: colors.danger },
    reconnecting: { label: 'Reconnecting', color: '#F6B94A' },
    error: { label: 'Connection error', color: colors.danger },
  }[status] ?? { label: 'Disconnected', color: colors.danger };

  return (
    <View
      accessibilityLabel={`Desktop status: ${statusPresentation.label}`}
      style={styles.container}
    >
      <View
        style={[styles.indicator, { backgroundColor: statusPresentation.color }]}
      />
      <View style={styles.copy}>
        <Text style={styles.label}>DESKTOP STATUS</Text>
        <Text style={styles.value}>{statusPresentation.label}</Text>
      </View>
      <View style={styles.liveBadge}>
        <Text style={styles.liveText}>LIVE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  indicator: {
    borderRadius: radius.round,
    height: 10,
    marginRight: spacing.md,
    width: 10,
  },
  copy: { flex: 1 },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  value: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  liveBadge: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  liveText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
