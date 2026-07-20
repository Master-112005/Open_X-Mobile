import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MobileBottomDock, { getMobileBottomDockHeight } from '../components/MobileBottomDock';
import ScreenBackground from '../components/ScreenBackground';
import { useApp } from '../context/AppContext';
import { colors, gradients, radius, shadows, spacing } from '../styles/theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad = (value) => String(value).padStart(2, '0');

function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localTimeValue(date = new Date(Date.now() + 60 * 60 * 1000)) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dateFromKey(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
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
      style={({ pressed }) => [styles.kindButton, active && styles.kindActive, pressed && styles.pressed]}
    >
      <Ionicons color={colors.text} name={icon} size={17} />
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
  const bottomDockHeight = getMobileBottomDockHeight(insets);
  const [selectedDate, setSelectedDate] = useState(localDateValue());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [addOpen, setAddOpen] = useState(false);
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

  const itemsByDay = useMemo(() => {
    const map = new Map();
    for (const item of activeItems) {
      const key = localDateValue(new Date(item.dueAt));
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [activeItems]);

  const monthDays = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = localDateValue(date);
      return {
        key,
        date,
        inMonth: date.getMonth() === visibleMonth.getMonth(),
        today: key === localDateValue(),
        selected: key === selectedDate,
        count: itemsByDay.get(key)?.length || 0,
      };
    });
  }, [itemsByDay, selectedDate, visibleMonth]);

  const selectedItems = itemsByDay.get(selectedDate) || [];
  const monthLabel = visibleMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });
  const statusText = scheduleLastSyncedAt
    ? `Synced ${formatTime(scheduleLastSyncedAt)}`
    : schedulesLoaded ? 'Saved on this mobile' : 'Loading';

  const moveMonth = (offset) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const openAdd = () => {
    setDateText(selectedDate);
    setTimeText(localTimeValue());
    setAddOpen(true);
  };

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
      setSelectedDate(localDateValue(dueAt));
      setVisibleMonth(new Date(dueAt.getFullYear(), dueAt.getMonth(), 1));
      setAddOpen(false);
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
    <ScreenBackground>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>{statusText}</Text>
        </View>
        <Pressable accessibilityLabel="Sync calendar" accessibilityRole="button" onPress={requestScheduleSync} style={styles.iconButton}>
          <Ionicons color={colors.text} name="sync-outline" size={21} />
        </Pressable>
        <Pressable accessibilityLabel="Add plan" accessibilityRole="button" onPress={openAdd} style={styles.primaryIconButton}>
          <Ionicons color={colors.background} name="add" size={24} />
        </Pressable>
      </View>

      <View style={[styles.content, { paddingBottom: bottomDockHeight + spacing.md }]}>
        <LinearGradient colors={gradients.glassDark} style={styles.calendarPanel}>
          <View style={styles.monthHeader}>
            <Pressable accessibilityRole="button" onPress={() => moveMonth(-1)} style={styles.monthButton}>
              <Ionicons color={colors.textSecondary} name="chevron-back" size={19} />
            </Pressable>
            <Text style={styles.monthTitle}>{monthLabel}</Text>
            <Pressable accessibilityRole="button" onPress={() => moveMonth(1)} style={styles.monthButton}>
              <Ionicons color={colors.textSecondary} name="chevron-forward" size={19} />
            </Pressable>
          </View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekText}>{day}</Text>
            ))}
          </View>
          <View style={styles.dayGrid}>
            {monthDays.map((day) => (
              <Pressable
                accessibilityLabel={`Select ${day.key}`}
                accessibilityRole="button"
                key={day.key}
                onPress={() => setSelectedDate(day.key)}
                style={({ pressed }) => [
                  styles.dayCell,
                  !day.inMonth && styles.dayMuted,
                  day.selected && styles.daySelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.dayText, day.selected && styles.dayTextSelected]}>
                  {day.date.getDate()}
                </Text>
                {day.count > 0 ? <View style={[styles.planDot, day.selected && styles.planDotSelected]} /> : null}
              </Pressable>
            ))}
          </View>
        </LinearGradient>

        <LinearGradient colors={gradients.glassDark} style={styles.planPanel}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planTitle}>Day Plan</Text>
              <Text style={styles.planSubtitle}>{dateFromKey(selectedDate).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
            </View>
            <Text style={styles.planCount}>{selectedItems.length}</Text>
          </View>
          <FlatList
            contentContainerStyle={styles.planList}
            data={selectedItems}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>No plans for this day.</Text>}
            renderItem={({ item }) => (
              <View style={styles.scheduleCard}>
                <View style={styles.scheduleIcon}>
                  <Ionicons color={colors.text} name={kindIcon(item.kind)} size={19} />
                </View>
                <View style={styles.scheduleBody}>
                  <Text numberOfLines={2} style={styles.scheduleTitle}>{item.message || item.title}</Text>
                  <Text style={styles.scheduleMeta}>{formatTime(item.dueAt)} - {item.kind}</Text>
                </View>
                <Pressable
                  accessibilityLabel={`Remove ${item.message || item.title}`}
                  accessibilityRole="button"
                  onPress={() => confirmRemove(item)}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                >
                  <Ionicons color={colors.danger} name="trash-outline" size={17} />
                </Pressable>
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
        </LinearGradient>
      </View>

      <Modal animationType="fade" onRequestClose={() => setAddOpen(false)} transparent visible={addOpen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <LinearGradient colors={gradients.glass} style={styles.addPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Plan</Text>
              <Pressable accessibilityLabel="Close add plan" accessibilityRole="button" onPress={() => setAddOpen(false)} style={styles.modalClose}>
                <Ionicons color={colors.text} name="close" size={21} />
              </Pressable>
            </View>
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
        </KeyboardAvoidingView>
      </Modal>
      <MobileBottomDock
        activeRoute="Calendar"
        navigation={navigation}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  iconButton: {
    ...shadows.floating,
    alignItems: 'center',
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderBright,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  primaryIconButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.round,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  content: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  calendarPanel: {
    ...shadows.card,
    borderColor: colors.borderBright,
    borderRadius: radius.xl,
    borderWidth: 1,
    flex: 1,
    padding: spacing.md,
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthButton: {
    alignItems: 'center',
    borderRadius: radius.round,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  monthTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  dayGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: '16.66%',
    justifyContent: 'center',
    width: '14.285%',
  },
  dayMuted: {
    opacity: 0.34,
  },
  daySelected: {
    backgroundColor: colors.white,
    borderRadius: radius.round,
  },
  dayText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  dayTextSelected: {
    color: colors.background,
  },
  planDot: {
    backgroundColor: colors.success,
    borderRadius: radius.round,
    height: 4,
    marginTop: 3,
    width: 4,
  },
  planDotSelected: {
    backgroundColor: colors.background,
  },
  planPanel: {
    ...shadows.card,
    borderColor: colors.borderBright,
    borderRadius: radius.xl,
    borderWidth: 1,
    flex: 1,
    padding: spacing.md,
  },
  planHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  planTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  planSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  planCount: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  planList: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  scheduleCard: {
    alignItems: 'center',
    backgroundColor: colors.contentElevated,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.md,
  },
  scheduleIcon: {
    alignItems: 'center',
    backgroundColor: colors.glassStrong,
    borderRadius: radius.round,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  scheduleBody: { flex: 1, minWidth: 0 },
  scheduleTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  scheduleMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  deleteButton: {
    alignItems: 'center',
    borderRadius: radius.round,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  addPanel: {
    ...shadows.floating,
    borderColor: colors.borderBright,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  modalClose: {
    alignItems: 'center',
    borderRadius: radius.round,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  kindRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kindButton: {
    alignItems: 'center',
    backgroundColor: colors.contentElevated,
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: colors.borderBright,
  },
  kindText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  input: {
    backgroundColor: colors.content,
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
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  disabled: { opacity: 0.48 },
});
