import { Ionicons } from '@expo/vector-icons';
import appConfig from '../../app.json';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassPanel from '../components/GlassPanel';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../styles/theme';

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>{value || '--'}</Text>
    </View>
  );
}

function HeaderButton({ onPress }) {
  return (
    <Pressable
      accessibilityLabel="Go back"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      <Ionicons color={colors.text} name="chevron-back" size={22} />
    </Pressable>
  );
}

export default function ProfileScreen({ navigation }) {
  const {
    cloudStatus,
    connectionMode,
    connectionStatus,
    deviceId,
    deviceName,
    paired,
    pairedAt,
    sessionValid,
  } = useApp();
  const insets = useSafeAreaInsets();
  const isCloud = connectionMode === 'cloud';
  const status = isCloud ? cloudStatus?.state : connectionStatus;
  const connected = isCloud ? cloudStatus?.connected === true : connectionStatus === 'connected';
  const version = appConfig?.expo?.version || '1.0.0';

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <HeaderButton onPress={() => navigation.goBack()} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 92, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>OpenX connection and device info.</Text>

        <GlassPanel style={styles.heroCard} contentStyle={styles.heroContent}>
          <View style={styles.avatar}>
            <Ionicons color={colors.text} name="person-outline" size={28} />
          </View>
          <View style={styles.heroText}>
            <Text numberOfLines={1} style={styles.name}>{deviceName || 'OpenX Mobile'}</Text>
            <View style={[styles.statusPill, connected ? styles.statusOn : styles.statusOff]}>
              <View style={[styles.statusDot, connected ? styles.dotOn : styles.dotOff]} />
              <Text style={styles.statusText}>{status || 'offline'}</Text>
            </View>
          </View>
        </GlassPanel>

        <Text style={styles.sectionTitle}>Device</Text>
        <GlassPanel style={styles.card} contentStyle={styles.cardContent}>
          <InfoRow label="Name" value={deviceName} />
          <InfoRow label="Device ID" value={deviceId} />
          <InfoRow label="App Version" value={version} />
          <InfoRow label="Platform" value="Mobile" />
        </GlassPanel>

        <Text style={styles.sectionTitle}>Connection</Text>
        <GlassPanel style={styles.card} contentStyle={styles.cardContent}>
          <InfoRow label="Mode" value={isCloud ? 'Cloud relay' : 'Local network'} />
          <InfoRow label="Paired" value={paired ? 'Yes' : 'No'} />
          <InfoRow
            label="Paired At"
            value={pairedAt ? new Date(pairedAt).toLocaleString() : '--'}
          />
          <InfoRow label="Session" value={sessionValid ? 'Active' : 'Needs reconnect'} />
        </GlassPanel>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
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
  content: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  heroCard: {
    borderRadius: radius.lg,
    marginTop: spacing.xl,
  },
  heroContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  statusPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    minHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  statusOn: {
    backgroundColor: 'rgba(70, 217, 145, 0.12)',
    borderColor: 'rgba(70, 217, 145, 0.34)',
  },
  statusOff: {
    backgroundColor: 'rgba(255, 102, 117, 0.10)',
    borderColor: 'rgba(255, 102, 117, 0.30)',
  },
  statusDot: {
    borderRadius: radius.round,
    height: 8,
    width: 8,
  },
  dotOn: { backgroundColor: colors.success },
  dotOff: { backgroundColor: colors.danger },
  statusText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  card: {
    borderRadius: radius.lg,
  },
  cardContent: {
    padding: spacing.lg,
  },
  infoRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 42,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  infoValue: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
});
