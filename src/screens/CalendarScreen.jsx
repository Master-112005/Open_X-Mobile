import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../context/AppContext';
import { colors, gradients, radius, shadows, spacing } from '../styles/theme';

const pad = (value) => String(value).padStart(2, '0');

function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localTimeValue(date = new Date(Date.now() + 60 * 60 * 1000)) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateKey(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'No date';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function kindIcon(kind) {
  const value = String(kind || '').toLowerCase();
  if (value === 'alarm') return 'alarm-outline';
  if (value === 'timer') return 'timer-outline';
  return 'notifications-outline';
}

function KindButton({ active, icon, label, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.kindButton,
        active && styles.kindActive,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons color={colors.text} name={icon} size={18} />
      <Text style={styles.kindText}>{label}</Text>
    </Pressable>
  );
}

export default function CalendarScreen({ navigation }) {
  const {
    scheduleItems,
    scheduleLastSyncedAt,
    schedulesLoaded,
    requestScheduleSync,
    upsertScheduleItem,
    removeScheduleItem,
    showNotice,
  } = useApp();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState('Reminder');
  const [message, setMessage] = useState('');
  const [dateText, setDateText] = useState(localDateValue());
  const [timeText, setTimeText] = useState(localTimeValue());
  const [saving, setSaving] = useState(false);

  const activeItems = useMemo(() => (
    scheduleItems
      .filter((item) => ['scheduled', 'paused', 'due'].includes(String(item.status || '').toLowerCase()))
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
  ), [scheduleItems]);

  const groupedItems = useMemo(() => {
    const rows = [];
    let currentDate = '';
    for (const item of activeItems) {
      const key = localDateValue(new Date(item.dueAt));
      if (key !== currentDate) {
        currentDate = key;
        rows.push({ id: `date-${key}`, type: 'date', label: formatDateKey(item.dueAt) });
      }
      rows.push({ ...item, type: 'item' });
    }
    return rows;
  }, [activeItems]);

  const handleSave = async () => {
    const title = message.replace(/\s+/g, ' ').trim();
    if (!title) {
      showNotice({ title: 'Add details', message: 'Enter what OpenX should remember.', tone: 'warning' });
      return;
    }
    const dueAt = new Date(`${dateText.trim()}T${timeText.trim()}:00`);
    if (!Number.isFinite(dueAt.getTime())) {
      showNotice({ title: 'Check time', message: 'Use date as YYYY-MM-DD and time as HH:MM.', tone: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await upsertScheduleItem({
        kind,
        title: `OpenX ${kind}`,
        message: title,
        dueAt: dueAt.toISOString(),
        status: 'scheduled',
        category: kind.toLowerCase(),
        source: 'mobile',
      });
      setMessage('');
    } catch (error) {
      showNotice({ title: 'Unable to save', message: error.message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = (item) => {
    showNotice({
      title: 'Remove reminder',
      message: `Remove "${item.message || item.title}" from your calendar?`,
      tone: 'warning',
      actions: [
        { label: 'Cancel' },
        {
          label: 'Remove',
          tone: 'danger',
          onPress: () => {
            removeScheduleItem(item.id).catch((error) => {
              showNotice({ title: 'Unable to remove', message: error.message, tone: 'error' });
            });
          },
        },
      ],
    });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="chevron-back" size={24} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>
            {scheduleLastSyncedAt ? `Synced ${formatTime(scheduleLastSyncedAt)}` : schedulesLoaded ? 'Saved on this mobile' : 'Loading'}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={requestScheduleSync} style={styles.iconButton}>
          <Ionicons color={colors.text} name="sync-outline" size={22} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={gradients.glass} style={styles.addPanel}>
          <View style={styles.kindRow}>
            <KindButton active={kind === 'Reminder'} icon="notifications-outline" label="Reminder" onPress={() => setKind('Reminder')} />
            <KindButton active={kind === 'Alarm'} icon="alarm-outline" label="Alarm" onPress={() => setKind('Alarm')} />
            <KindButton active={kind === 'Timer'} icon="timer-outline" label="Timer" onPress={() => setKind('Timer')} />
          </View>
          <TextInput
            maxLength={240}
            onChangeText={setMessage}
            placeholder="What should OpenX remember?"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={message}
          />
          <View style={styles.dateRow}>
            <TextInput
              keyboardType="numbers-and-punctuation"
              onChangeText={setDateText}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.dateInput]}
              value={dateText}
            />
            <TextInput
              keyboardType="numbers-and-punctuation"
              onChangeText={setTimeText}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.timeInput]}
              value={timeText}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={handleSave}
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, saving && styles.disabled]}
          >
            <Ionicons color={colors.background} name="add-circle-outline" size={20} />
            <Text style={styles.saveText}>{saving ? 'Saving' : 'Add'}</Text>
          </Pressable>
        </LinearGradient>

        <FlatList
          data={groupedItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            item.type === 'date' ? (
              <Text style={styles.dateHeader}>{item.label}</Text>
            ) : (
              <LinearGradient colors={gradients.glassSoft} style={styles.scheduleCard}>
                <View style={styles.scheduleIcon}>
                  <Ionicons color={colors.text} name={kindIcon(item.kind)} size={20} />
                </View>
                <View style={styles.scheduleBody}>
                  <Text numberOfLines={2} style={styles.scheduleTitle}>{item.message || item.title}</Text>
                  <Text style={styles.scheduleMeta}>{formatTime(item.dueAt)} - {item.kind}</Text>
                </View>
                <View style={[styles.statusDot, item.status === 'due' ? styles.dueDot : styles.scheduledDot]} />
                <Pressable
                  accessibilityLabel={`Remove ${item.message || item.title}`}
                  accessibilityRole="button"
                  onPress={() => confirmRemove(item)}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                >
                  <Ionicons color={colors.danger} name="trash-outline" size={18} />
                </Pressable>
              </LinearGradient>
            )
          )}
          scrollEnabled={false}
          ListEmptyComponent={<Text style={styles.empty}>No timers, reminders, or alarms yet.</Text>}
        />
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  iconButton: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  headerText: { flex: 1 },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  addPanel: {
    ...shadows.card,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  kindRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kindButton: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 40,
  },
  kindActive: {
    borderColor: colors.borderBright,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  kindText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateInput: { flex: 1.35 },
  timeInput: { flex: 0.8 },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.round,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 46,
  },
  saveText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '900',
  },
  dateHeader: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    textTransform: 'uppercase',
  },
  scheduleCard: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  scheduleIcon: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderRadius: radius.round,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  scheduleBody: { flex: 1 },
  scheduleTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  scheduleMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  statusDot: {
    borderRadius: radius.round,
    height: 10,
    width: 10,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  scheduledDot: { backgroundColor: colors.success },
  dueDot: { backgroundColor: colors.warning },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  disabled: { opacity: 0.48 },
});
