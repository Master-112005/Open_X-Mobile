import { Ionicons } from '@expo/vector-icons';
import packageJson from '../../package.json';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassPanel from '../components/GlassPanel';
import MobileBottomDock, { getMobileBottomDockHeight } from '../components/MobileBottomDock';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../styles/theme';

const PROFILE_FIELDS = [
  ['fullName', 'Name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['company', 'Company'],
  ['role', 'Role'],
  ['country', 'Country'],
  ['addressLine1', 'Address'],
  ['city', 'City'],
  ['state', 'State'],
  ['postalCode', 'Postal Code'],
];

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>{value || '--'}</Text>
    </View>
  );
}

function ProfileValueRow({ label, value }) {
  return (
    <View style={styles.profileValueRow}>
      <Text style={styles.profileValueText} numberOfLines={2}>
        <Text style={styles.profileValueLabel}>{label}</Text>
        <Text style={styles.profileSeparator}> :- </Text>
        <Text>{value || '--'}</Text>
      </Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const {
    cloudStatus,
    connectionMode,
    connectionStatus,
    deviceId,
    deviceName,
    openXProfile,
    paired,
    pairedAt,
    saveOpenXProfile,
    sessionValid,
  } = useApp();
  const [draftProfile, setDraftProfile] = useState(openXProfile || {});
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const editAnimation = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const isCloud = connectionMode === 'cloud';
  const status = isCloud ? cloudStatus?.state : connectionStatus;
  const connected = isCloud ? cloudStatus?.connected === true : connectionStatus === 'connected';
  const version = packageJson?.version || '1.0.0';
  const bottomDockHeight = getMobileBottomDockHeight(insets);

  useEffect(() => {
    setDraftProfile(openXProfile || {});
  }, [openXProfile]);

  useEffect(() => {
    Animated.timing(editAnimation, {
      toValue: editingProfile ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [editAnimation, editingProfile]);

  const updateProfileField = (field, value) => {
    setDraftProfile((current) => ({ ...current, [field]: value }));
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await saveOpenXProfile(draftProfile);
      setEditingProfile(false);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    setDraftProfile(openXProfile || {});
    setEditingProfile(false);
  };

  const toggleProfileEditor = () => {
    if (editingProfile) {
      handleCancelEdit();
      return;
    }
    setDraftProfile(openXProfile || {});
    setEditingProfile(true);
  };

  const editorStyle = {
    maxHeight: editAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 430],
    }),
    opacity: editAnimation,
    transform: [{
      translateY: editAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [-10, 0],
      }),
    }],
    paddingTop: editAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, spacing.md],
    }),
  };

  const summaryStyle = {
    maxHeight: editAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [320, 0],
    }),
    opacity: editAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
    transform: [{
      translateY: editAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -8],
      }),
    }],
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: bottomDockHeight + spacing.xl },
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

        <Text style={styles.standaloneSectionTitle}>Device</Text>
        <GlassPanel style={styles.card} contentStyle={styles.cardContent}>
          <InfoRow label="Name" value={deviceName} />
          <InfoRow label="Device ID" value={deviceId} />
          <InfoRow label="App Version" value={version} />
          <InfoRow label="Platform" value="Mobile" />
        </GlassPanel>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>OpenX Profile</Text>
          <Pressable
            accessibilityLabel={editingProfile ? 'Close profile editor' : 'Edit profile'}
            accessibilityRole="button"
            onPress={toggleProfileEditor}
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.text} name={editingProfile ? 'close' : 'create-outline'} size={18} />
          </Pressable>
        </View>
        <GlassPanel style={styles.card} contentStyle={styles.cardContent}>
          <Animated.View pointerEvents={editingProfile ? 'none' : 'auto'} style={[styles.profileValueList, summaryStyle]}>
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={styles.profileFieldScroll}
            >
              {PROFILE_FIELDS.map(([field, label]) => (
                <ProfileValueRow key={field} label={label} value={openXProfile?.[field]} />
              ))}
            </ScrollView>
          </Animated.View>
          <Animated.View pointerEvents={editingProfile ? 'auto' : 'none'} style={[styles.profileEditor, editorStyle]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={styles.profileEditorScroll}
            >
              {PROFILE_FIELDS.map(([field, label]) => (
                <View key={field} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{label}</Text>
                  <TextInput
                    autoCapitalize={field === 'email' ? 'none' : 'words'}
                    keyboardType={field === 'email' ? 'email-address' : field === 'phone' ? 'phone-pad' : 'default'}
                    onChangeText={(value) => updateProfileField(field, value)}
                    placeholder="--"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    value={draftProfile?.[field] || ''}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={styles.profileEditorActions}>
              <Pressable
                accessibilityRole="button"
                disabled={savingProfile}
                onPress={handleCancelEdit}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed, savingProfile && styles.disabled]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={savingProfile}
                onPress={handleSaveProfile}
                style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, savingProfile && styles.disabled]}
              >
                <Text style={styles.saveButtonText}>{savingProfile ? 'Saving...' : 'Save Profile'}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </GlassPanel>

        <Text style={styles.standaloneSectionTitle}>Connection</Text>
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
      <MobileBottomDock
        activeRoute="Settings"
        navigation={navigation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
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
  },
  standaloneSectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  editButton: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  card: {
    borderRadius: radius.lg,
  },
  cardContent: {
    padding: spacing.lg,
  },
  profileValueList: {
    overflow: 'hidden',
  },
  profileFieldScroll: {
    maxHeight: 320,
  },
  profileValueRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 34,
    paddingVertical: spacing.xs,
  },
  profileValueText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  profileValueLabel: {
    color: colors.textMuted,
    fontWeight: '900',
  },
  profileSeparator: {
    color: colors.textMuted,
  },
  profileEditor: {
    overflow: 'hidden',
  },
  profileEditorScroll: {
    maxHeight: 346,
  },
  inputGroup: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  inputLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.glassSubtle,
    borderColor: colors.borderBright,
    borderWidth: 1,
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  saveButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.62,
  },
  profileEditorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
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
