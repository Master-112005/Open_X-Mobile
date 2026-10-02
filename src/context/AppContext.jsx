import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import {
  createTransferRecord,
  loadTransferHistory,
  persistTransferHistory,
  prepareOutgoingFile,
  removeReceivedFile,
  storeIncomingFile,
} from '../services/fileTransfer';
import {
  DEFAULT_PERMISSIONS,
  loadPermissionState,
  normalizePermissions,
  persistPermissionState,
} from '../services/permissions';
import {
  loadSchedules,
  mergeScheduleItems,
  normalizeScheduleItem,
  persistSchedules,
  schedulesFromSnapshot,
} from '../services/scheduleStore';
import {
  formatScheduleDue,
  nextScheduleDueForRecurrence,
} from '../services/mobileScheduleIntelligence';
import { routeMobileCommand } from '../services/mobileCommandRouter';
import {
  EMPTY_SESSION,
  clearPersistedSession,
  isSessionValid,
  loadSession,
  normalizeSession,
  persistSession,
} from '../services/session';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import OpenXNotice from '../components/OpenXNotice';
import { websocketService } from '../services/websocket';
import {
  MOBILE_APP_VERSION,
  normalizeCloudSettings,
  normalizeRelayUrl,
  relayClient,
} from '../services/relayClient';
import { CloudFileTransferManager } from '../services/cloudFileTransfer';

const SETTINGS_KEY = '@openx/settings';
const PAIRING_KEY = '@openx/pairing';
const PROFILE_KEY = '@openx/profile';
const CHAT_HISTORY_KEY = '@openx/chat-history-v1';
const DIRTY_SCHEDULES_KEY = '@openx/schedules/dirty';
const CLOUD_E2EE_KEY = 'openx.cloud.e2eeMasterKey';
const DEFAULT_PORT = '8080';
const DEFAULT_DEVICE_NAME = 'My Mobile';
const DEFAULT_CONNECTION_MODE = 'cloud';
const PAIRING_TIMEOUT_MS = 15000;
const CLOUD_COMMAND_TIMEOUT_MS = 75000;
const CONNECTION_ERROR_MESSAGE = 'Waiting for OpenX Desktop...';
const MAX_MOBILE_CHAT_HISTORY = 300;
const MAX_MOBILE_MESSAGE_TEXT = 3000;
const MAX_MOBILE_MESSAGE_DATA_BYTES = 20000;
const isCloudFileTransferRequestId = (value) =>
  /^cloud_(?:mobile_)?transfer_[A-Za-z0-9._:-]+:/i.test(String(value || '').trim());

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const parseStoredObject = (value) => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const loadCloudE2EEKey = async () => {
  try {
    return await SecureStore.getItemAsync(CLOUD_E2EE_KEY);
  } catch {
    return '';
  }
};

const persistCloudE2EEKey = async (masterKey) => {
  const key = String(masterKey || '').trim();
  if (!key) return false;
  try {
    await SecureStore.setItemAsync(CLOUD_E2EE_KEY, key);
    return true;
  } catch {
    return false;
  }
};

const createMessage = (role, text, timestamp = Date.now(), metadata = {}) => {
  const parsedTimestamp = new Date(timestamp);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    text,
    timestamp: Number.isNaN(parsedTimestamp.getTime())
      ? new Date().toISOString()
      : parsedTimestamp.toISOString(),
    ...metadata,
  };
};

const sanitizeMessageText = (value) =>
  String(value || '')
    .replace(/\b(password|passcode|token|api\s*key|secret|authorization|bearer)\s*[:=]\s*[^\s,;]+/gi, '$1: [redacted]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MOBILE_MESSAGE_TEXT);

const sanitizePersistedMessageData = (data) => {
  if (!data || typeof data !== 'object') return null;
  try {
    const text = JSON.stringify(data);
    if (text.length > MAX_MOBILE_MESSAGE_DATA_BYTES) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const normalizeStoredMessage = (message = {}) => {
  const role = ['user', 'assistant', 'system'].includes(message.role)
    ? message.role
    : 'assistant';
  const text = sanitizeMessageText(message.text);
  if (!text) return null;
  const parsedTimestamp = new Date(message.timestamp || message.createdAt || Date.now());
  const timestamp = Number.isNaN(parsedTimestamp.getTime())
    ? new Date().toISOString()
    : parsedTimestamp.toISOString();
  const data = sanitizePersistedMessageData(message.data);
  const choices = Array.isArray(message.choices)
    ? message.choices.slice(0, 8)
    : (Array.isArray(data?.choices) ? data.choices.slice(0, 8) : []);
  return {
    id: String(message.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    role,
    text,
    timestamp,
    intent: typeof message.intent === 'string' ? message.intent.slice(0, 120) : null,
    data,
    entities: sanitizePersistedMessageData(message.entities),
    choices,
    needsClarification: message.needsClarification === true,
  };
};

const normalizeStoredMessages = (value) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed)
      ? parsed.map(normalizeStoredMessage).filter(Boolean).slice(-MAX_MOBILE_CHAT_HISTORY)
      : [];
  } catch {
    return [];
  }
};

const initialMessages = [];

const initialPairingData = {
  deviceId: '',
  deviceName: DEFAULT_DEVICE_NAME,
  paired: false,
  pairedAt: null,
};

const normalizeConnectionSettings = (settings) => {
  const serverIp = String(
    settings.serverIp ?? settings.desktopAddress ?? '',
  ).trim();
  const serverPort = String(
    settings.serverPort ?? settings.desktopPort ?? DEFAULT_PORT,
  ).trim();

  const connectionMode = 'cloud';

  return {
    connectionMode,
    serverIp,
    serverPort: serverPort || DEFAULT_PORT,
    desktopAddress: serverIp,
    desktopPort: serverPort || DEFAULT_PORT,
    cloud: normalizeCloudSettings(settings.cloud || {}),
  };
};

const normalizeDeviceName = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);

const PROFILE_FIELDS = [
  'fullName',
  'email',
  'phone',
  'addressLine1',
  'city',
  'state',
  'postalCode',
  'country',
  'company',
  'role',
];

const EMPTY_PROFILE = Object.freeze(Object.fromEntries(PROFILE_FIELDS.map((field) => [field, ''])));

const parseStoredArray = (value) => {
  const parsed = parseStoredObject(value);
  if (Array.isArray(parsed)) return parsed;
  try {
    const direct = JSON.parse(value || '[]');
    return Array.isArray(direct) ? direct : [];
  } catch {
    return [];
  }
};

const normalizeOpenXProfile = (profile = {}) => {
  const source = profile && typeof profile === 'object' ? profile : {};
  return Object.fromEntries(PROFILE_FIELDS.map((field) => [
    field,
    String(source[field] || '').replace(/\s+/g, ' ').trim().slice(0, field === 'addressLine1' ? 180 : 120),
  ]));
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [messages, setMessages] = useState(initialMessages);
  const [connectionStatus, setConnectionStatus] = useState(relayClient.getStatus().state || 'disconnected');
  const [connectionMode, setConnectionModeState] = useState(DEFAULT_CONNECTION_MODE);
  const [cloudStatus, setCloudStatus] = useState(relayClient.getStatus());
  const [cloudPresence, setCloudPresence] = useState([]);
  const [cloudSettings, setCloudSettings] = useState(normalizeCloudSettings());
  const [remoteTargets, setRemoteTargets] = useState([]);
  const [remoteControlStatus, setRemoteControlStatus] = useState('');
  const [remoteControlBusy, setRemoteControlBusy] = useState(false);
  const [desktopAddress, setDesktopAddress] = useState('');
  const [desktopPort, setDesktopPort] = useState(DEFAULT_PORT);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState(DEFAULT_DEVICE_NAME);
  const [openXProfile, setOpenXProfile] = useState(EMPTY_PROFILE);
  const [paired, setPaired] = useState(false);
  const [pairedAt, setPairedAt] = useState(null);
  const [pairingLoaded, setPairingLoaded] = useState(false);
  const [transferHistory, setTransferHistory] = useState([]);
  const [transfersLoaded, setTransfersLoaded] = useState(false);
  const [lastTransferEvent, setLastTransferEvent] = useState(null);
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [permissionsLastUpdated, setPermissionsLastUpdated] = useState(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [scheduleLastSyncedAt, setScheduleLastSyncedAt] = useState(null);
  const [notice, setNotice] = useState(null);
  const [sessionValid, setSessionValid] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const pairingDataRef = useRef(initialPairingData);
  const pendingPairingRef = useRef(null);
  const pendingCloudRequestsRef = useRef(new Map());
  const pendingRemoteRequestsRef = useRef(new Map());
  const reconnectActiveConnectionRef = useRef(null);
  const cloudFileTransferRef = useRef(null);
  const transferHistoryRef = useRef([]);
  const permissionsRef = useRef(DEFAULT_PERMISSIONS);
  const scheduleItemsRef = useRef([]);
  const dirtyScheduleIdsRef = useRef(new Set());
  const scheduleNotificationIdsRef = useRef(new Map());
  const notificationPermissionRef = useRef(null);
  const sessionRef = useRef(EMPTY_SESSION);
  const settingsRef = useRef(normalizeConnectionSettings({}));
  const openXProfileRef = useRef(EMPTY_PROFILE);
  const chatHistoryLoadedRef = useRef(false);

  const showNotice = useCallback((nextNotice) => {
    const normalized = typeof nextNotice === 'string'
      ? { title: 'OpenX', message: nextNotice }
      : nextNotice;
    setNotice({ id: Date.now(), tone: 'info', dismissible: true, ...normalized });
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const applyPairingData = useCallback((data) => {
    pairingDataRef.current = data;
    const cloudPairing = data.cloudPairing || {};
    relayClient.setDeviceIdentity({
      deviceId: data.deviceId,
      ownerId: cloudPairing.ownerId || '',
      pairedWithDeviceId: cloudPairing.desktopDeviceId || '',
      deviceName: data.deviceName,
      deviceType: 'phone',
      platform: Platform.OS || 'mobile',
      softwareVersion: MOBILE_APP_VERSION,
    });
    setDeviceId(data.deviceId);
    setDeviceName(data.deviceName);
    setPaired(data.paired);
    setPairedAt(data.pairedAt);
  }, []);

  const ensurePairingIdentity = useCallback(async (preferredName = DEFAULT_DEVICE_NAME) => {
    const current = pairingDataRef.current || initialPairingData;
    const deviceId = String(current.deviceId || '').trim() || Crypto.randomUUID();
    const deviceName = normalizeDeviceName(current.deviceName || preferredName || DEFAULT_DEVICE_NAME) || DEFAULT_DEVICE_NAME;
    const nextPairingData = {
      ...current,
      deviceId,
      deviceName,
      paired: current.paired === true,
      pairedAt: current.pairedAt ?? null,
      cloudPairing: current.cloudPairing || null,
    };
    applyPairingData(nextPairingData);
    await AsyncStorage.setItem(PAIRING_KEY, JSON.stringify(nextPairingData));
    return nextPairingData;
  }, [applyPairingData]);

  const recordTransfer = useCallback((record) => {
    const nextHistory = [record, ...transferHistoryRef.current].slice(0, 100);
    transferHistoryRef.current = nextHistory;
    setTransferHistory(nextHistory);
    persistTransferHistory(nextHistory).catch(() => {
      setLastTransferEvent({
        id: Date.now(),
        type: 'error',
        message: 'Unable to save transfer history.',
      });
    });
    return record;
  }, []);

  const applyPermissionState = useCallback((permissionState) => {
    permissionsRef.current = permissionState.permissions;
    setPermissions(permissionState.permissions);
    setPermissionsLastUpdated(permissionState.lastUpdated);
  }, []);

  const applySession = useCallback((session) => {
    sessionRef.current = session;
    setSessionValid(isSessionValid(session));
    setSessionExpiresAt(session.expiresAt);
  }, []);

  const applyScheduleItems = useCallback((items, syncedAt = null) => {
    const merged = mergeScheduleItems(scheduleItemsRef.current, items);
    scheduleItemsRef.current = merged;
    setScheduleItems(merged);
    if (syncedAt) setScheduleLastSyncedAt(syncedAt);
    persistSchedules(merged).catch(() => {
      console.warn('Unable to persist OpenX schedules.');
    });
    return merged;
  }, []);

  const persistDirtyScheduleIds = useCallback(() => (
    AsyncStorage.setItem(DIRTY_SCHEDULES_KEY, JSON.stringify([...dirtyScheduleIdsRef.current]))
      .catch(() => {
        console.warn('Unable to persist pending OpenX schedule sync state.');
      })
  ), []);

  const markScheduleDirty = useCallback((scheduleId) => {
    const id = String(scheduleId || '').trim();
    if (!id) return;
    dirtyScheduleIdsRef.current.add(id);
    persistDirtyScheduleIds();
  }, [persistDirtyScheduleIds]);

  const clearSyncedScheduleIds = useCallback((items = []) => {
    let changed = false;
    for (const item of items) {
      const id = String(item?.id || item?.taskName || '').trim();
      if (id && dirtyScheduleIdsRef.current.delete(id)) changed = true;
    }
    if (changed) persistDirtyScheduleIds();
  }, [persistDirtyScheduleIds]);

  const applyScheduleSnapshot = useCallback((snapshot) => {
    const items = schedulesFromSnapshot(snapshot);
    clearSyncedScheduleIds(items);
    return applyScheduleItems(items, snapshot?.generatedAt || new Date().toISOString());
  }, [applyScheduleItems, clearSyncedScheduleIds]);

  const applyOpenXProfile = useCallback((profile, persist = true) => {
    const normalized = normalizeOpenXProfile(profile);
    openXProfileRef.current = normalized;
    setOpenXProfile(normalized);
    if (persist) {
      AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(normalized)).catch(() => {
        console.warn('Unable to persist OpenX profile.');
      });
    }
    return normalized;
  }, []);

  const persistConnectionSettings = useCallback(async (updates = {}) => {
    const nextSettings = normalizeConnectionSettings({
      ...settingsRef.current,
      ...updates,
      cloud: {
        ...settingsRef.current.cloud,
        ...(updates.cloud || {}),
      },
    });
    settingsRef.current = nextSettings;
    setConnectionModeState(nextSettings.connectionMode);
    setDesktopAddress(nextSettings.serverIp);
    setDesktopPort(nextSettings.serverPort);
    setCloudSettings(nextSettings.cloud);
    relayClient.updateSettings(nextSettings.cloud);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    return nextSettings;
  }, []);

  const activateCloudMode = useCallback(async (updates = {}) => {
    websocketService.disconnect();
    const nextCloud = normalizeCloudSettings({
      ...settingsRef.current.cloud,
      ...(updates.cloud || updates),
    });
    return persistConnectionSettings({
      connectionMode: 'cloud',
      cloud: nextCloud,
    });
  }, [persistConnectionSettings]);

  const clearCloudRequest = useCallback((requestId) => {
    const pending = pendingCloudRequestsRef.current.get(requestId);
    if (!pending) return null;
    clearTimeout(pending.timer);
    pendingCloudRequestsRef.current.delete(requestId);
    return pending;
  }, []);

  const refreshCloudRequestTimeout = useCallback((requestId) => {
    const pending = pendingCloudRequestsRef.current.get(requestId);
    if (!pending) return false;
    clearTimeout(pending.timer);
    pending.timer = setTimeout(() => {
      if (!pendingCloudRequestsRef.current.has(requestId)) return;
      pendingCloudRequestsRef.current.delete(requestId);
      setMessages((current) => [
        ...current,
        createMessage('assistant', 'Cloud command timed out. Please try again.'),
      ]);
      reconnectActiveConnectionRef.current?.().catch(() => {});
    }, CLOUD_COMMAND_TIMEOUT_MS);
    return true;
  }, []);

  const markCloudRequestProcessing = useCallback((requestId, message, timestamp = Date.now()) => {
    const pending = pendingCloudRequestsRef.current.get(requestId);
    if (!pending) return false;
    refreshCloudRequestTimeout(requestId);
    const text = String(message || 'OpenX Desktop is processing your command.').trim();
    if (pending.statusMessageId) {
      const parsedTimestamp = new Date(timestamp);
      const safeTimestamp = Number.isNaN(parsedTimestamp.getTime())
        ? new Date().toISOString()
        : parsedTimestamp.toISOString();
      setMessages((current) => current.map((item) => (
        item.id === pending.statusMessageId
          ? {
              ...item,
              text,
              timestamp: safeTimestamp,
              pending: true,
            }
          : item
      )));
      return true;
    }
    const statusMessage = createMessage('assistant', text, timestamp, {
      pending: true,
      intent: 'assistant-status',
      requestId,
    });
    pending.statusMessageId = statusMessage.id;
    setMessages((current) => [...current, statusMessage]);
    return true;
  }, [refreshCloudRequestTimeout]);

  const clearRemoteRequest = useCallback((requestId) => {
    const pending = pendingRemoteRequestsRef.current.get(requestId);
    if (!pending) return null;
    clearTimeout(pending.timer);
    pendingRemoteRequestsRef.current.delete(requestId);
    setRemoteControlBusy([...pendingRemoteRequestsRef.current.values()].some(item => item.action === 'listTargets'));
    return pending;
  }, []);

  const sendCloudScheduleSync = useCallback((action = 'request', schedule = null) => {
    const cloudPairing = pairingDataRef.current.cloudPairing || {};
    if (
      settingsRef.current.connectionMode !== 'cloud' ||
      !relayClient.isConnected() ||
      !pairingDataRef.current.paired ||
      !cloudPairing.ownerId ||
      !cloudPairing.desktopDeviceId ||
      !pairingDataRef.current.deviceId
    ) {
      return false;
    }
    const requestId = Crypto.randomUUID();
    return relayClient.sendRelayPacket({
      packetId: `cloud_schedule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      protocolVersion: 1,
      packetType: 'request',
      sourceDeviceId: cloudPairing.phoneDeviceId || pairingDataRef.current.deviceId,
      destinationDeviceId: cloudPairing.desktopDeviceId,
      ownerId: cloudPairing.ownerId,
      timestamp: Date.now(),
      requestId,
      responseId: null,
      metadata: {
        feature: 'schedule-sync',
        deviceName: pairingDataRef.current.deviceName,
      },
      checksum: null,
      encryption: null,
      payload: {
        type: 'schedule-sync',
        action,
        schedule,
        deviceName: pairingDataRef.current.deviceName,
        metadata: { client: 'openx-mobile' },
      },
    });
  }, []);

  const flushDirtyScheduleSync = useCallback(() => {
    if (settingsRef.current.connectionMode !== 'cloud' || !relayClient.isConnected()) return 0;
    const ids = [...dirtyScheduleIdsRef.current];
    let sent = 0;
    for (const id of ids) {
      const schedule = scheduleItemsRef.current.find((item) => item.id === id || item.taskName === id);
      if (schedule && sendCloudScheduleSync('upsert', schedule)) sent += 1;
    }
    return sent;
  }, [sendCloudScheduleSync]);

  const sendCloudProfileSync = useCallback((action = 'request', profile = null) => {
    const cloudPairing = pairingDataRef.current.cloudPairing || {};
    if (
      settingsRef.current.connectionMode !== 'cloud' ||
      !relayClient.isConnected() ||
      !pairingDataRef.current.paired ||
      !cloudPairing.ownerId ||
      !cloudPairing.desktopDeviceId ||
      !pairingDataRef.current.deviceId
    ) {
      return false;
    }
    const requestId = Crypto.randomUUID();
    return relayClient.sendRelayPacket({
      packetId: `cloud_profile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      protocolVersion: 1,
      packetType: 'request',
      sourceDeviceId: cloudPairing.phoneDeviceId || pairingDataRef.current.deviceId,
      destinationDeviceId: cloudPairing.desktopDeviceId,
      ownerId: cloudPairing.ownerId,
      timestamp: Date.now(),
      requestId,
      responseId: null,
      metadata: {
        feature: 'profile-sync',
        deviceName: pairingDataRef.current.deviceName,
      },
      checksum: null,
      encryption: null,
      payload: {
        type: 'profile-sync',
        action,
        profile: profile ? normalizeOpenXProfile(profile) : undefined,
        metadata: { client: 'openx-mobile' },
      },
    });
  }, []);

  const sendCloudRemoteControl = useCallback((action = 'listTargets', control = {}) => {
    const normalizedAction = action === 'control' ? 'control' : 'listTargets';
    const cloudPairing = pairingDataRef.current.cloudPairing || {};
    const cloudDesktopReady = settingsRef.current.connectionMode === 'cloud' &&
      relayClient.isConnected() &&
      pairingDataRef.current.paired &&
      cloudPairing.ownerId &&
      cloudPairing.desktopDeviceId &&
      pairingDataRef.current.deviceId;

    if (!cloudDesktopReady) {
      setRemoteControlStatus('Connect this phone to OpenX Desktop before using Remote.');
      return false;
    }

    const requestId = Crypto.randomUUID();
    const packetId = `cloud_remote_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const timer = setTimeout(() => {
      if (!pendingRemoteRequestsRef.current.has(requestId)) return;
      pendingRemoteRequestsRef.current.delete(requestId);
      setRemoteControlBusy([...pendingRemoteRequestsRef.current.values()].some(pending => pending.action === 'listTargets'));
      setRemoteControlStatus('Remote request timed out. Check that OpenX Desktop is online.');
    }, normalizedAction === 'listTargets' ? 9000 : 5000);

    pendingRemoteRequestsRef.current.set(requestId, { packetId, timer, action: normalizedAction });
    setRemoteControlBusy([...pendingRemoteRequestsRef.current.values()].some(pending => pending.action === 'listTargets'));
    setRemoteControlStatus(normalizedAction === 'listTargets'
      ? 'Looking for active remote apps on OpenX Desktop.'
      : 'Sending remote command.');

    const payload = {
      type: 'remote-control',
      action: normalizedAction,
      deviceName: pairingDataRef.current.deviceName,
      metadata: { client: 'openx-mobile' },
    };

    if (normalizedAction === 'control') {
      payload.targetId = String(control.targetId || control.target || '').trim();
      payload.command = String(control.command || control.action || 'center').trim();
      payload.windowTitle = String(control.windowTitle || '').trim();
      payload.tabTitle = String(control.tabTitle || '').trim();
      payload.targetHandle = Number.isSafeInteger(Number(control.targetHandle || control.handle))
        ? Number(control.targetHandle || control.handle)
        : undefined;
      payload.targetProcessId = Number.isSafeInteger(Number(control.targetProcessId || control.processId))
        ? Number(control.targetProcessId || control.processId)
        : undefined;
      payload.processName = String(control.processName || '').trim();
    }

    const sent = relayClient.sendRelayPacket({
      packetId,
      protocolVersion: 1,
      packetType: 'request',
      sourceDeviceId: cloudPairing.phoneDeviceId || pairingDataRef.current.deviceId,
      destinationDeviceId: cloudPairing.desktopDeviceId,
      ownerId: cloudPairing.ownerId,
      timestamp: Date.now(),
      requestId,
      responseId: null,
      metadata: {
        feature: 'remote-control',
        deviceName: pairingDataRef.current.deviceName,
        retryable: false,
      },
      checksum: null,
      encryption: null,
      payload,
    });

    if (!sent) {
      clearRemoteRequest(requestId);
      setRemoteControlStatus('OpenX Desktop is not reachable.');
      return false;
    }

    return true;
  }, [clearRemoteRequest]);

  const ensureNotificationPermission = useCallback(async () => {
    if (notificationPermissionRef.current === true) return true;
    if (notificationPermissionRef.current === false) return false;
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('openx-schedules', {
          name: 'OpenX reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 180, 250],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }
      const current = await Notifications.getPermissionsAsync();
      const requested = current.granted ? current : await Notifications.requestPermissionsAsync();
      notificationPermissionRef.current = requested.granted === true;
      return notificationPermissionRef.current;
    } catch {
      notificationPermissionRef.current = false;
      return false;
    }
  }, []);

  const cancelLocalScheduleNotification = useCallback(async (scheduleId) => {
    const id = String(scheduleId || '').trim();
    if (!id) return false;
    const record = scheduleNotificationIdsRef.current.get(id);
    if (!record?.notificationId) return false;
    scheduleNotificationIdsRef.current.delete(id);
    try {
      await Notifications.cancelScheduledNotificationAsync(record.notificationId);
      return true;
    } catch {
      return false;
    }
  }, []);

  const presentScheduleDueNotification = useCallback(async (schedule) => {
    const item = normalizeScheduleItem(schedule);
    if (!item || !(await ensureNotificationPermission())) return false;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${item.kind || 'Reminder'} due`,
          body: item.message || item.title,
          data: { scheduleId: item.id, kind: item.kind || 'Reminder', source: 'openx' },
          sound: true,
        },
        trigger: null,
      });
      return true;
    } catch {
      return false;
    }
  }, [ensureNotificationPermission]);

  const scheduleLocalScheduleNotification = useCallback(async (schedule) => {
    const item = normalizeScheduleItem(schedule);
    if (!item || String(item.status || '').toLowerCase() !== 'scheduled') return false;
    const dueAt = new Date(item.dueAt);
    if (!Number.isFinite(dueAt.getTime()) || dueAt.getTime() <= Date.now()) return false;
    const current = scheduleNotificationIdsRef.current.get(item.id);
    if (current?.dueAt === item.dueAt && current?.status === item.status) return true;
    if (current?.notificationId) await cancelLocalScheduleNotification(item.id);
    if (!(await ensureNotificationPermission())) return false;
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${item.kind || 'Reminder'} due`,
          body: item.message || item.title,
          data: { scheduleId: item.id, kind: item.kind || 'Reminder', source: 'openx' },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: dueAt,
          channelId: Platform.OS === 'android' ? 'openx-schedules' : undefined,
        },
      });
      scheduleNotificationIdsRef.current.set(item.id, {
        notificationId,
        dueAt: item.dueAt,
        status: item.status,
      });
      return true;
    } catch {
      return false;
    }
  }, [cancelLocalScheduleNotification, ensureNotificationPermission]);

  const requestScheduleSync = useCallback(() => {
    if (settingsRef.current.connectionMode === 'cloud') {
      return sendCloudScheduleSync('request');
    }
    if (
      websocketService.getStatus() !== 'connected' ||
      !pairingDataRef.current.paired ||
      !isSessionValid(sessionRef.current)
    ) {
      return false;
    }
    return websocketService.sendScheduleSyncRequest({
      requestId: Crypto.randomUUID(),
      timestamp: Date.now(),
      deviceId: pairingDataRef.current.deviceId,
      deviceName: pairingDataRef.current.deviceName,
      sessionToken: sessionRef.current.sessionToken,
    });
  }, [sendCloudScheduleSync]);

  const normalizeCloudAssistantPacket = useCallback((packet = {}) => {
    const envelope = packet?.payload && typeof packet.payload === 'object' ? packet.payload : {};
    const nestedPayload = envelope.payload && typeof envelope.payload === 'object'
      ? envelope.payload
      : null;
    const directResult = envelope.result && typeof envelope.result === 'object'
      ? envelope.result
      : null;
    const status = String(envelope.status || (packet.packetType === 'response' ? 'completed' : 'failed')).toLowerCase();
    const resultSource = nestedPayload || directResult || envelope;
    const errorMessage = envelope.error?.message || envelope.message || packet.error?.message || '';
    const responseText =
      resultSource.response ||
      resultSource.message ||
      errorMessage ||
      (status === 'completed' ? 'Command completed.' : 'Cloud command failed.');
    const data = resultSource.data && typeof resultSource.data === 'object'
      ? { ...resultSource.data }
      : {};
    if (!Array.isArray(data.choices) && Array.isArray(resultSource.choices)) {
      data.choices = resultSource.choices;
    }
    if (!Array.isArray(data.entries) && Array.isArray(resultSource.entries)) {
      data.entries = resultSource.entries;
    }
    if (!Array.isArray(data.resultEntries) && Array.isArray(resultSource.resultEntries)) {
      data.resultEntries = resultSource.resultEntries;
    }
    [
      'photos',
      'images',
      'memories',
      'matches',
      'people',
      'collections',
      'visualResults',
    ].forEach((key) => {
      if (!Array.isArray(data[key]) && Array.isArray(resultSource[key])) {
        data[key] = resultSource[key];
      }
    });
    if (!data.gallery && resultSource.gallery && typeof resultSource.gallery === 'object') {
      data.gallery = resultSource.gallery;
    }
    return {
      requestId: envelope.requestId || packet.requestId || '',
      timestamp: envelope.timestamp || packet.timestamp || Date.now(),
      status,
      responseType: envelope.responseType || packet.metadata?.feature || '',
      result: {
        success: resultSource.success !== false && status === 'completed',
        response: responseText,
        message: resultSource.message || responseText,
        intent: resultSource.intent || null,
        entities: resultSource.entities || null,
        needsClarification: resultSource.needsClarification === true,
        requiresConfirmation: resultSource.requiresConfirmation === true,
        data: Object.keys(data).length > 0 ? data : null,
        error: resultSource.error || envelope.error?.code || null,
      },
    };
  }, []);

  const handleRemoteControlPacket = useCallback((packet = {}) => {
    const envelope = packet?.payload && typeof packet.payload === 'object' ? packet.payload : {};
    const requestId = envelope.requestId || packet.requestId || '';
    const isRemotePacket = packet.metadata?.feature === 'remote-control' ||
      envelope.responseType === 'remote-control' ||
      pendingRemoteRequestsRef.current.has(requestId);
    if (!isRemotePacket) return false;

    if (requestId) clearRemoteRequest(requestId);

    const remotePayload = envelope.payload && typeof envelope.payload === 'object'
      ? envelope.payload
      : envelope;
    const data = remotePayload.data && typeof remotePayload.data === 'object'
      ? remotePayload.data
      : {};
    const status = String(envelope.status || (packet.packetType === 'response' ? 'completed' : 'failed')).toLowerCase();
    const success = remotePayload.success !== false && status === 'completed';

    if (Array.isArray(data.targets)) {
      const targets = data.targets
        .filter((target) => target && typeof target === 'object')
        .map((target) => ({
          id: String(target.id || '').trim(),
          label: String(target.label || target.id || 'Remote app').trim(),
          kind: String(target.kind || '').trim(),
          handle: Number.isSafeInteger(Number(target.handle)) && Number(target.handle) > 0 ? Number(target.handle) : null,
          processId: Number.isSafeInteger(Number(target.processId)) && Number(target.processId) > 0 ? Number(target.processId) : null,
          processName: String(target.processName || '').trim(),
          windowTitle: String(target.windowTitle || '').trim(),
          tabTitle: String(target.tabTitle || '').trim(),
          source: String(target.source || '').trim(),
          active: target.active === true,
        }))
        .filter((target) => target.id);
      setRemoteTargets(targets);
      setRemoteControlStatus(targets.length
        ? `${targets.length} active remote app${targets.length === 1 ? '' : 's'} found.`
        : 'No active remote apps found. Open YouTube, PowerPoint, Instagram, or Spotify on Desktop.');
      return true;
    }

    setRemoteControlStatus(success
      ? 'Remote command sent.'
      : (remotePayload.message || remotePayload.error?.message || envelope.error?.message || 'Remote command failed.'));
    return true;
  }, [clearRemoteRequest]);

  const appendCloudAssistantResult = useCallback((result, timestamp = Date.now(), pending = null) => {
    const responseText = result?.response || result?.message || 'Command completed.';
    const finalMessage = createMessage('assistant', responseText, timestamp, {
        intent: result?.intent || null,
        data: result?.data || null,
        entities: result?.entities || null,
        choices: Array.isArray(result?.data?.choices) ? result.data.choices : [],
        needsClarification: result?.needsClarification === true,
      });
    if (pending?.statusMessageId) {
      setMessages((current) => current.map((item) => (
        item.id === pending.statusMessageId
          ? { ...item, ...finalMessage, id: item.id, pending: false }
          : item
      )));
      return;
    }
    setMessages((current) => [...current, finalMessage]);
  }, []);

  const reconnectActiveConnection = useCallback(() => {
    if (settingsRef.current.connectionMode === 'cloud') {
      const cloud = settingsRef.current.cloud || {};
      return relayClient.reconnect().catch(() => relayClient.connect(cloud));
    }

    const address = String(settingsRef.current.serverIp || desktopAddress || '').trim();
    const port = String(settingsRef.current.serverPort || desktopPort || DEFAULT_PORT).trim();
    if (!address || !port) {
      return Promise.reject(new Error('Desktop connection is not configured.'));
    }
    return websocketService.reconnect().catch(() => websocketService.connect(address, port));
  }, [desktopAddress, desktopPort]);
  reconnectActiveConnectionRef.current = reconnectActiveConnection;

  useEffect(() => {
    let mounted = true;

    const rejectPendingPairing = (message) => {
      const pending = pendingPairingRef.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingPairingRef.current = null;
      pending.reject(new Error(message));
    };

    const handleSecurityFailure = (message) => {
      applySession({ ...EMPTY_SESSION });
      clearPersistedSession().catch(() => {
        console.warn('Unable to clear expired OpenX session.');
      });
      setMessages((current) => [
        ...current,
        createMessage('assistant', message),
      ]);
    };

    const unsubscribeStatus = websocketService.subscribeToStatus((status) => {
      if (mounted) setConnectionStatus(status);
      if (status === 'disconnected' || status === 'error') {
        rejectPendingPairing(CONNECTION_ERROR_MESSAGE);
      }
    });

    const unsubscribeCloudStatus = relayClient.subscribeToStatus((status) => {
      if (mounted) {
        setCloudStatus(status);
        setConnectionStatus(status?.state || (status?.connected ? 'connected' : 'disconnected'));
      }
    });

    const unsubscribeCloudPresence = relayClient.subscribeToPresence((presence) => {
      if (mounted) setCloudPresence(presence);
    });

    const cloudTransferManager = new CloudFileTransferManager({
      relayClient,
      getPairingData: () => pairingDataRef.current,
      recordTransfer,
      onIncomingTransfer: (transfer) => {
        if (!mounted) return;
        showNotice({
          title: 'Incoming cloud file',
          message: `${transfer.fileName} (${transfer.fileSize} bytes)`,
          tone: 'info',
          dismissible: false,
          actions: [
            {
              label: 'Reject',
              onPress: () => cloudFileTransferRef.current?.rejectTransfer(transfer.transferId),
            },
            {
              label: 'Accept',
              tone: 'primary',
              onPress: () => cloudFileTransferRef.current?.acceptTransfer(transfer.transferId),
            },
          ],
        });
      },
      onTransferEvent: (event) => {
        if (!mounted) return;
        if (event.type === 'completed' && event.record) {
          setLastTransferEvent({
            id: Date.now(),
            type: 'success',
            message: `${event.fileName} transfer completed.`,
          });
          return;
        }
        if (event.type === 'failed') {
          setLastTransferEvent({
            id: Date.now(),
            type: 'error',
            message: `${event.fileName} transfer failed.`,
          });
        }
      },
    });
    cloudFileTransferRef.current = cloudTransferManager;
    cloudTransferManager.start();

    const unsubscribeRelayPackets = relayClient.subscribeToRelayPackets((message) => {
      if (!mounted || settingsRef.current.connectionMode !== 'cloud') return;
      if (message.type === 'relay:ack') return;
      if (message.type === 'relay:error') {
        const requestId = message.requestId || '';
        if (requestId && clearRemoteRequest(requestId)) {
          setRemoteControlStatus(message.message || 'Remote command failed.');
          return;
        }
        if (requestId) clearCloudRequest(requestId);
        if (isCloudFileTransferRequestId(requestId)) return;
        setMessages((current) => [
          ...current,
          createMessage('assistant', message.message || 'Cloud command failed.'),
        ]);
        return;
      }
      if (message.type !== 'relay:packet') return;
      const packet = message.packet || {};
      if (packet.payload?.type === 'cloud-file-transfer') return;
      if (handleRemoteControlPacket(packet)) return;
      if (packet.payload?.type === 'schedule-sync') {
        if (packet.payload?.snapshot) applyScheduleSnapshot(packet.payload.snapshot);
        return;
      }
      if (packet.payload?.type === 'profile-sync') {
        const profile = packet.payload?.snapshot?.profile || packet.payload?.profile;
        if (profile) applyOpenXProfile(profile);
        return;
      }
      const response = normalizeCloudAssistantPacket(packet);
      const requestId = response.requestId || '';
      if (response.status === 'processing' || response.responseType === 'assistant-status') {
        if (requestId) {
          markCloudRequestProcessing(
            requestId,
            response.result?.response || response.result?.message,
            response.timestamp || packet.timestamp || Date.now(),
          );
        }
        return;
      }
      const pending = requestId ? clearCloudRequest(requestId) : null;
      const result = response.result;
      if (result?.data?.scheduleSync && result.data.snapshot) {
        applyScheduleSnapshot(result.data.snapshot);
        return;
      }
      appendCloudAssistantResult(result, response.timestamp || packet.timestamp || Date.now(), pending);
    });

    const unsubscribeMessages = websocketService.subscribeToMessages(
      (message) => {
        if (!mounted) return;
        if (settingsRef.current.connectionMode === 'cloud') return;

        if (message.type === 'pair-success') {
          const pending = pendingPairingRef.current;
          const previousPairingData = pairingDataRef.current;
          const currentConnection = websocketService.getConnectionConfig();
          const receivedConnection = normalizeConnectionSettings({
            serverIp: message.serverIp || currentConnection.serverIp,
            serverPort: message.serverPort || currentConnection.serverPort,
          });
          const nextPairingData = {
            ...previousPairingData,
            deviceId: message.deviceId || previousPairingData.deviceId,
            deviceName:
              pending?.deviceName || pairingDataRef.current.deviceName,
            paired: true,
            pairedAt: Date.now(),
          };
          const receivedSession = normalizeSession(message);

          if (receivedSession.sessionToken) {
            applySession(receivedSession);
            persistSession(receivedSession).catch(() => {
              console.warn('Unable to persist OpenX session.');
            });
          }

          applyPairingData(nextPairingData);
          setDesktopAddress(receivedConnection.serverIp);
          setDesktopPort(receivedConnection.serverPort);
          Promise.all([
            AsyncStorage.setItem(PAIRING_KEY, JSON.stringify(nextPairingData)),
            AsyncStorage.setItem(
              SETTINGS_KEY,
              JSON.stringify(receivedConnection),
            ),
          ])
            .then(() => {
              if (!pending || pendingPairingRef.current !== pending) return;
              clearTimeout(pending.timer);
              pendingPairingRef.current = null;
              pending.resolve(nextPairingData);
            })
            .catch(() => {
              applyPairingData(previousPairingData);
              if (!pending || pendingPairingRef.current !== pending) return;
              clearTimeout(pending.timer);
              pendingPairingRef.current = null;
              pending.reject(new Error('Unable to save pairing information.'));
            });
          return;
        }

        if (message.type === 'pair-failed') {
          rejectPendingPairing('Invalid or expired pairing code.');
          return;
        }

        if (message.type === 'session-renewed') {
          const renewedSession = normalizeSession(message);
          if (!isSessionValid(renewedSession)) {
            handleSecurityFailure('Device authentication failed. Please reconnect.');
            return;
          }
          applySession(renewedSession);
          persistSession(renewedSession).catch(() => {
            console.warn('Unable to persist renewed OpenX session.');
          });
          return;
        }

        if (message.type === 'session-expired') {
          handleSecurityFailure('Session expired. Please reconnect.');
          return;
        }

        if (
          message.type === 'authentication-failed' ||
          message.type === 'authentication-failure' ||
          message.type === 'auth-failed' ||
          message.type === 'auth-failure'
        ) {
          handleSecurityFailure('Device authentication failed. Please reconnect.');
          return;
        }

        if (message.type === 'error') {
          const errorCode = String(message.code || '').toUpperCase();
          const errorMessage = String(message.message || '');
          if (
            errorCode === 'SESSION_EXPIRED' ||
            /session expired/i.test(errorMessage)
          ) {
            handleSecurityFailure('Session expired. Please reconnect.');
            return;
          }
          if (
            errorCode === 'AUTHENTICATION_FAILED' ||
            errorCode === 'DEVICE_AUTHENTICATION_FAILED' ||
            errorCode === 'AUTH_FAILED' ||
            /authentication failed/i.test(errorMessage)
          ) {
            handleSecurityFailure(
              'Device authentication failed. Please reconnect.',
            );
            return;
          }
        }

        if (message.type === 'permissions') {
          const permissionState = {
            permissions: normalizePermissions(
              message.permissions,
              permissionsRef.current,
            ),
            lastUpdated: Date.now(),
          };
          applyPermissionState(permissionState);
          persistPermissionState(permissionState).catch(() => {
            console.warn('Unable to persist desktop permissions.');
          });
          return;
        }

        if (message.type === 'schedule-sync:snapshot') {
          applyScheduleSnapshot(message.snapshot);
          return;
        }

        if (message.type === 'incoming-file' || message.type === 'file-transfer') {
          const transferId = message.transferId || message.requestId || null;
          const sendReceipt = ({ success, error = null }) => {
            websocketService.sendTransferReceipt({
              transferId,
              requestId: transferId,
              timestamp: Date.now(),
              deviceId: pairingDataRef.current.deviceId,
              sessionToken: sessionRef.current.sessionToken,
              fileName: message.fileName,
              success,
              error,
            });
          };

          if (!pairingDataRef.current.paired) {
            const errorMessage = 'Pair device before transferring files.';
            sendReceipt({ success: false, error: errorMessage });
            recordTransfer(
              createTransferRecord({
                direction: 'received',
                fileName: message.fileName,
                fileSize: Number(message.fileSize),
                status: 'failed',
                error: errorMessage,
              }),
            );
            setLastTransferEvent({
              id: Date.now(),
              type: 'error',
              message: errorMessage,
            });
            return;
          }

          if (!isSessionValid(sessionRef.current)) {
            const errorMessage = 'Session expired. Please reconnect.';
            sendReceipt({ success: false, error: errorMessage });
            recordTransfer(
              createTransferRecord({
                direction: 'received',
                fileName: message.fileName,
                fileSize: Number(message.fileSize),
                status: 'failed',
                error: errorMessage,
              }),
            );
            setLastTransferEvent({
              id: Date.now(),
              type: 'error',
              message: errorMessage,
            });
            return;
          }

          if (!permissionsRef.current.fileTransfer) {
            const errorMessage = 'File transfers disabled by desktop.';
            sendReceipt({ success: false, error: errorMessage });
            recordTransfer(
              createTransferRecord({
                direction: 'received',
                fileName: message.fileName,
                fileSize: Number(message.fileSize),
                status: 'failed',
                error: errorMessage,
              }),
            );
            setLastTransferEvent({
              id: Date.now(),
              type: 'error',
              message: errorMessage,
            });
            return;
          }

          if (!permissionsRef.current.receiveFiles) {
            const errorMessage = 'Receiving files disabled by desktop.';
            sendReceipt({ success: false, error: errorMessage });
            recordTransfer(
              createTransferRecord({
                direction: 'received',
                fileName: message.fileName,
                fileSize: Number(message.fileSize),
                status: 'failed',
                error: errorMessage,
              }),
            );
            setLastTransferEvent({
              id: Date.now(),
              type: 'error',
              message: errorMessage,
            });
            return;
          }

          storeIncomingFile(message)
            .then((record) => {
              sendReceipt({ success: true });
              if (!mounted) return;
              recordTransfer(record);
              setLastTransferEvent({
                id: Date.now(),
                type: 'success',
                message: `${record.fileName} was received successfully.`,
              });
            })
            .catch((error) => {
              sendReceipt({ success: false, error: error.message });
              if (!mounted) return;
              recordTransfer(
                createTransferRecord({
                  direction: 'received',
                  fileName: message.fileName,
                  fileSize: Number(message.fileSize),
                  status: 'failed',
                  error: error.message,
                }),
              );
              setLastTransferEvent({
                id: Date.now(),
                type: 'error',
                message: error.message,
              });
            });
          return;
        }

        const responseText =
          message.message ||
          (message.type === 'error'
            ? 'Unable to execute command.'
            : 'Command completed.');

        setMessages((current) => [
          ...current,
          createMessage('assistant', responseText, message.timestamp, {
            intent: message.intent || null,
            data: message.data || null,
            entities: message.entities || null,
            choices: Array.isArray(message.data?.choices) ? message.data.choices : [],
            needsClarification: message.needsClarification === true,
          }),
        ]);
      },
    );

    async function loadLocalData() {
      try {
        const [
          savedSettings,
          savedPairing,
          savedCloudE2EEKey,
          savedTransferHistory,
          savedPermissionState,
          savedSession,
          savedSchedules,
          savedProfile,
          savedDirtySchedules,
          savedChatHistory,
        ] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(PAIRING_KEY),
          loadCloudE2EEKey(),
          loadTransferHistory(),
          loadPermissionState(),
          loadSession(),
          loadSchedules(),
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(DIRTY_SCHEDULES_KEY),
          AsyncStorage.getItem(CHAT_HISTORY_KEY),
        ]);
        if (!mounted) return;

        const parsedSettings = normalizeConnectionSettings(
          parseStoredObject(savedSettings),
        );
        const storedSettings = parseStoredObject(savedSettings);
        const parsedPairing = parseStoredObject(savedPairing);
        const savedAddress = parsedSettings.serverIp;
        const savedPort = parsedSettings.serverPort;
        settingsRef.current = parsedSettings;
        setConnectionModeState(parsedSettings.connectionMode);
        setCloudSettings(parsedSettings.cloud);
        relayClient.updateSettings(parsedSettings.cloud);
        if (savedCloudE2EEKey) relayClient.setE2EEMasterKey(savedCloudE2EEKey);
        const nextPairingData = {
          deviceId: parsedPairing.deviceId || Crypto.randomUUID(),
          deviceName: parsedPairing.deviceName || DEFAULT_DEVICE_NAME,
          paired: parsedPairing.paired === true,
          pairedAt: parsedPairing.pairedAt ?? null,
          cloudPairing: parsedPairing.cloudPairing || null,
        };

        setDesktopAddress(savedAddress);
        setDesktopPort(savedPort);
        applyPairingData(nextPairingData);
        transferHistoryRef.current = savedTransferHistory;
        setTransferHistory(savedTransferHistory);
        dirtyScheduleIdsRef.current = new Set(
          parseStoredArray(savedDirtySchedules)
            .map((id) => String(id || '').trim())
            .filter(Boolean),
        );
        scheduleItemsRef.current = savedSchedules;
        setScheduleItems(savedSchedules);
        setMessages(normalizeStoredMessages(savedChatHistory));
        chatHistoryLoadedRef.current = true;
        applyOpenXProfile(parseStoredObject(savedProfile), false);
        applyPermissionState(savedPermissionState);
        applySession(savedSession);
        await AsyncStorage.setItem(
          PAIRING_KEY,
          JSON.stringify(nextPairingData),
        );
        if (JSON.stringify(parsedSettings) !== JSON.stringify(storedSettings)) {
          await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(parsedSettings));
        }

        websocketService.disconnect();
        if (parsedSettings.cloud.autoConnect) {
          relayClient.connect(parsedSettings.cloud).catch(() => {
            // Cloud status and reconnect are managed by relayClient.
          });
        }
      } catch (error) {
        console.warn('Unable to load OpenX local data.', error);
      } finally {
        if (mounted) {
          chatHistoryLoadedRef.current = true;
          setSettingsLoaded(true);
          setPairingLoaded(true);
          setTransfersLoaded(true);
          setPermissionsLoaded(true);
          setSchedulesLoaded(true);
          setSessionLoaded(true);
        }
      }
    }

    loadLocalData();

    return () => {
      mounted = false;
      const pending = pendingPairingRef.current;
      if (pending) clearTimeout(pending.timer);
      pendingPairingRef.current = null;
      unsubscribeStatus();
      unsubscribeCloudStatus();
      unsubscribeCloudPresence();
      unsubscribeRelayPackets();
      cloudTransferManager.stop();
      cloudFileTransferRef.current = null;
      unsubscribeMessages();
      pendingCloudRequestsRef.current.forEach((pending) => clearTimeout(pending.timer));
      pendingCloudRequestsRef.current.clear();
      pendingRemoteRequestsRef.current.forEach((pending) => clearTimeout(pending.timer));
      pendingRemoteRequestsRef.current.clear();
      websocketService.disconnect();
      relayClient.disconnect('app-context-unmount').catch(() => {});
    };
  }, [
    applyPairingData,
    applyOpenXProfile,
    applyPermissionState,
    applyScheduleSnapshot,
    applySession,
    appendCloudAssistantResult,
    clearCloudRequest,
    clearRemoteRequest,
    handleRemoteControlPacket,
    markCloudRequestProcessing,
    normalizeCloudAssistantPacket,
    recordTransfer,
    requestScheduleSync,
    showNotice,
  ]);

  useEffect(() => {
    if (!chatHistoryLoadedRef.current) return;
    const normalized = messages
      .map(normalizeStoredMessage)
      .filter(Boolean)
      .slice(-MAX_MOBILE_CHAT_HISTORY);
    AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(normalized)).catch(() => {
      console.warn('Unable to persist OpenX chat history.');
    });
  }, [messages]);

  useEffect(() => {
    let timer;

    const checkExpiration = () => {
      const remaining = sessionRef.current.expiresAt - Date.now();
      if (!isSessionValid(sessionRef.current)) {
        setSessionValid(false);
        return;
      }
      timer = setTimeout(checkExpiration, Math.min(remaining + 10, 2147483647));
    };

    if (sessionValid) checkExpiration();
    return () => clearTimeout(timer);
  }, [sessionExpiresAt, sessionValid]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        nextState === 'active' &&
        settingsRef.current.connectionMode === 'cloud' &&
        settingsRef.current.cloud.autoConnect &&
        !relayClient.isConnected()
      ) {
        relayClient.connect(settingsRef.current.cloud).catch(() => {
          // The cloud client keeps the UI responsive and handles retry state.
        });
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!settingsLoaded || !pairingLoaded || !paired) return;
    if (connectionMode === 'cloud') {
      if (cloudStatus?.connected) {
        flushDirtyScheduleSync();
        requestScheduleSync();
        sendCloudProfileSync('request');
      }
      return;
    }
    if (sessionLoaded && sessionValid && connectionStatus === 'connected') {
      requestScheduleSync();
    }
  }, [
    cloudStatus?.connected,
    connectionMode,
    connectionStatus,
    flushDirtyScheduleSync,
    paired,
    pairingLoaded,
    requestScheduleSync,
    sendCloudProfileSync,
    sessionLoaded,
    sessionValid,
    settingsLoaded,
  ]);

  useEffect(() => {
    if (!schedulesLoaded) return undefined;
    let cancelled = false;
    const syncNotifications = async () => {
      const activeIds = new Set();
      for (const item of scheduleItemsRef.current) {
        const normalized = normalizeScheduleItem(item);
        if (!normalized) continue;
        const dueMs = new Date(normalized.dueAt).getTime();
        if (String(normalized.status || '').toLowerCase() === 'scheduled' && Number.isFinite(dueMs) && dueMs > Date.now()) {
          activeIds.add(normalized.id);
          if (!cancelled) await scheduleLocalScheduleNotification(normalized);
        }
      }
      for (const id of scheduleNotificationIdsRef.current.keys()) {
        if (!activeIds.has(id) && !cancelled) await cancelLocalScheduleNotification(id);
      }
    };
    syncNotifications().catch(() => {
      console.warn('Unable to synchronize OpenX mobile schedule alerts.');
    });
    return () => {
      cancelled = true;
    };
  }, [cancelLocalScheduleNotification, scheduleItems, scheduleLocalScheduleNotification, schedulesLoaded]);

  useEffect(() => {
    if (!schedulesLoaded) return undefined;
    const now = Date.now();
    const scheduled = scheduleItemsRef.current
      .filter((item) => String(item.status || '').toLowerCase() === 'scheduled')
      .map((item) => ({ item, dueMs: new Date(item.dueAt).getTime() }))
      .filter(({ dueMs }) => Number.isFinite(dueMs))
      .sort((a, b) => a.dueMs - b.dueMs);
    const next = scheduled[0];
    if (!next) return undefined;

    const timer = setTimeout(() => {
      const dueNow = [];
      const updated = scheduleItemsRef.current.map((item) => {
        const dueMs = new Date(item.dueAt).getTime();
        if (String(item.status || '').toLowerCase() === 'scheduled' && Number.isFinite(dueMs) && dueMs <= Date.now()) {
          const recurrence = String(item.recurrence || item.metadata?.recurrence || '').trim();
          const nextDue = recurrence
            ? nextScheduleDueForRecurrence(recurrence, item.dueAt)
            : null;
          const dueItem = recurrence && nextDue && Number.isFinite(nextDue.getTime())
            ? { ...item, recurrence, dueAt: nextDue.toISOString(), status: 'scheduled', updatedAt: new Date().toISOString() }
            : { ...item, status: 'due', updatedAt: new Date().toISOString() };
          dueNow.push(dueItem);
          return dueItem;
        }
        return item;
      });
      if (dueNow.length === 0) return;
      scheduleItemsRef.current = updated;
      setScheduleItems(updated);
      persistSchedules(updated).catch(() => {
        console.warn('Unable to persist due OpenX schedules.');
      });
      dueNow.slice(0, 3).forEach((item) => {
        const hadScheduledNotification = scheduleNotificationIdsRef.current.has(item.id);
        cancelLocalScheduleNotification(item.id);
        if (!hadScheduledNotification) presentScheduleDueNotification(item);
      });
      dueNow.forEach((item) => {
        markScheduleDirty(item.id);
        if (settingsRef.current.connectionMode === 'cloud') sendCloudScheduleSync('upsert', item);
      });
    }, Math.max(0, Math.min(next.dueMs - now, 2147483647)));

    return () => clearTimeout(timer);
  }, [cancelLocalScheduleNotification, markScheduleDirty, presentScheduleDueNotification, scheduleItems, schedulesLoaded, sendCloudScheduleSync]);

  const handleLocalScheduleCommand = useCallback(async (normalizedText, parsed, options = {}) => {
    if (!parsed) return false;
    const now = new Date().toISOString();
    const schedule = normalizeScheduleItem({
      ...parsed,
      id: `OpenX_Mobile_${parsed.kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      taskName: `OpenX_Mobile_${parsed.kind}_${Date.now()}`,
      sourceDeviceId: pairingDataRef.current.deviceId,
      sourceDeviceName: pairingDataRef.current.deviceName,
      createdAt: now,
      updatedAt: now,
    });
    if (!schedule) {
      setMessages((current) => [
        ...current,
        createMessage('user', normalizedText),
        createMessage('assistant', 'I could not understand when to schedule that.'),
      ]);
      return true;
    }

    const merged = mergeScheduleItems(scheduleItemsRef.current, [schedule]);
    scheduleItemsRef.current = merged;
    setScheduleItems(merged);
    persistSchedules(merged).catch(() => {
      console.warn('Unable to persist OpenX mobile schedule command.');
    });
    scheduleLocalScheduleNotification(schedule).catch(() => {
      console.warn('Unable to schedule OpenX mobile alert.');
    });
    markScheduleDirty(schedule.id);
    if (options.syncNow === true) sendCloudScheduleSync('upsert', schedule);

    const syncNote = options.offlineFallback === true
      ? ' It will sync with OpenX Desktop when connected.'
      : '';
    setMessages((current) => [
      ...current,
      createMessage('user', normalizedText),
      createMessage('assistant', `${schedule.kind} set for ${formatScheduleDue(schedule.dueAt)}.${syncNote}`, Date.now(), {
        intent: `${String(schedule.kind).toLowerCase()}.set`,
        data: { schedule },
      }),
    ]);
    return true;
  }, [markScheduleDirty, scheduleLocalScheduleNotification, sendCloudScheduleSync]);

  const sendMessage = useCallback(
    async (text) => {
      const normalizedText = text.trim();
      if (!normalizedText) return false;
      const cloudPairing = pairingDataRef.current.cloudPairing || {};
      const cloudDesktopReady = settingsRef.current.connectionMode === 'cloud' &&
        relayClient.isConnected() && pairingDataRef.current.paired && cloudPairing.ownerId &&
        cloudPairing.desktopDeviceId && pairingDataRef.current.deviceId;
      const commandRoute = routeMobileCommand(normalizedText);
      if (commandRoute.route === 'local-schedule' && await handleLocalScheduleCommand(normalizedText, commandRoute.schedule, {
        syncNow: Boolean(cloudDesktopReady),
        offlineFallback: !cloudDesktopReady,
      })) return true;
      if (settingsRef.current.connectionMode === 'cloud') {
        const requestId = Crypto.randomUUID();
        const packetId = `cloud_command_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        if (!cloudDesktopReady) {
          setMessages((current) => [
            ...current,
            createMessage('user', normalizedText),
            createMessage('assistant', 'Cloud is not ready. Connect and pair this mobile app with OpenX Desktop.'),
          ]);
          return true;
        }

        const packet = {
          packetId,
          protocolVersion: 1,
          packetType: 'request',
          sourceDeviceId: cloudPairing.phoneDeviceId || pairingDataRef.current.deviceId,
          destinationDeviceId: cloudPairing.desktopDeviceId,
          ownerId: cloudPairing.ownerId,
          timestamp: Date.now(),
          requestId,
          responseId: null,
          metadata: {
            feature: 'assistant-command',
            deviceName: pairingDataRef.current.deviceName,
            retryable: true,
          },
          checksum: null,
          encryption: null,
          payload: {
            type: 'assistant-command',
            command: normalizedText,
            deviceName: pairingDataRef.current.deviceName,
            metadata: {
              client: 'openx-mobile',
              requestedAction: /^(?:open|launch|start|run|play|watch)\b/i.test(normalizedText) ? 'open' : undefined,
            },
          },
        };

        const timer = setTimeout(() => {
          if (!pendingCloudRequestsRef.current.has(requestId)) return;
          pendingCloudRequestsRef.current.delete(requestId);
          setMessages((current) => [
            ...current,
            createMessage('assistant', 'Cloud command timed out. Please try again.'),
          ]);
          reconnectActiveConnection().catch(() => {});
        }, CLOUD_COMMAND_TIMEOUT_MS);
        pendingCloudRequestsRef.current.set(requestId, { packetId, timer });
        const sent = relayClient.sendRelayPacket(packet);
        setMessages((current) => [
          ...current,
          createMessage('user', normalizedText),
          ...(!sent
            ? [createMessage('assistant', CONNECTION_ERROR_MESSAGE)]
            : []),
        ]);
        if (!sent) {
          clearCloudRequest(requestId);
          reconnectActiveConnection().catch(() => {});
        }
        return true;
      }

      const localDesktopReady = websocketService.getStatus() === 'connected' &&
        paired &&
        permissionsRef.current.remoteCommands;
      if (!localDesktopReady) {
        return false;
      }

      if (!isSessionValid(sessionRef.current)) {
        setMessages((current) => [
          ...current,
          createMessage('assistant', 'Session expired. Please reconnect.'),
        ]);
        setSessionValid(false);
        return true;
      }

      const payload = websocketService.sendCommand(normalizedText, {
        requestId: Crypto.randomUUID(),
        timestamp: Date.now(),
        deviceId: pairingDataRef.current.deviceId,
        deviceName: pairingDataRef.current.deviceName,
        sessionToken: sessionRef.current.sessionToken,
      });
      setMessages((current) => [
        ...current,
        createMessage('user', normalizedText, payload?.timestamp),
        ...(!payload
          ? [createMessage('assistant', CONNECTION_ERROR_MESSAGE)]
          : []),
      ]);
      if (!payload) reconnectActiveConnection().catch(() => {});

      return true;
    },
    [clearCloudRequest, handleLocalScheduleCommand, paired, reconnectActiveConnection],
  );

  const refreshRemoteTargets = useCallback(() => (
    sendCloudRemoteControl('listTargets')
  ), [sendCloudRemoteControl]);

  const sendRemoteControl = useCallback((control = {}) => {
    const targetId = String(control.targetId || control.target || '').trim();
    if (!targetId) {
      setRemoteControlStatus('Choose an active remote app first.');
      return false;
    }
    return sendCloudRemoteControl('control', {
      ...control,
      targetId,
      command: control.command || control.action || 'center',
    });
  }, [sendCloudRemoteControl]);

  const setConnectionMode = useCallback(async () => activateCloudMode(), [activateCloudMode]);

  const saveCloudSettings = useCallback(async (settings) => {
    const nextSettings = await activateCloudMode({ cloud: settings });
    return nextSettings.cloud;
  }, [activateCloudMode]);

  const connectCloud = useCallback(async (settings = {}) => {
    const nextSettings = await activateCloudMode({ cloud: settings });
    return relayClient.connect(nextSettings.cloud);
  }, [activateCloudMode]);

  const disconnectCloud = useCallback(async () => {
    const nextSettings = await persistConnectionSettings({
      connectionMode: 'cloud',
      cloud: {
        ...settingsRef.current.cloud,
        autoConnect: false,
      },
    });
    return relayClient.disconnect('manual-disconnect').then(() => nextSettings);
  }, [persistConnectionSettings]);

  const pairCloudDevice = useCallback(async ({ relayUrl, pairToken, security = null, deviceName: name }) => {
    const normalizedName = normalizeDeviceName(name || pairingDataRef.current.deviceName);
    if (!normalizedName) {
      throw new Error('Device name is required.');
    }
    const readyPairingData = await ensurePairingIdentity(normalizedName);

    const normalizedRelayUrl = normalizeRelayUrl(relayUrl);
    await activateCloudMode({ cloud: { relayUrl: normalizedRelayUrl } });
    applySession({ ...EMPTY_SESSION });
    clearPersistedSession().catch(() => {
      console.warn('Unable to reset the previous OpenX session.');
    });

    const result = await relayClient.pairWithToken({
      relayUrl: normalizedRelayUrl,
      pairToken,
      security,
      deviceName: normalizedName,
    });
    if (result.security?.masterKey) {
      persistCloudE2EEKey(result.security.masterKey).catch(() => {});
      relayClient.setE2EEMasterKey(result.security.masterKey);
    }

    const nextPairingData = {
      ...readyPairingData,
      deviceName: normalizedName,
      paired: true,
      pairedAt: Date.now(),
      cloudPairing: {
        relayUrl: normalizedRelayUrl,
        tokenId: result.tokenId || '',
        ownerId: result.ownerId || '',
        desktopDeviceId: result.desktopDeviceId || '',
        phoneDeviceId: result.phoneDeviceId || readyPairingData.deviceId,
        pair: result.pair || null,
        e2ee: result.security?.enabled === true,
        e2eeScheme: result.security?.scheme || '',
        pairedAt: Date.now(),
      },
    };
    applyPairingData(nextPairingData);
    await AsyncStorage.setItem(PAIRING_KEY, JSON.stringify(nextPairingData));
    return nextPairingData;
  }, [activateCloudMode, applyPairingData, applySession, ensurePairingIdentity]);

  const updateDeviceName = useCallback(async (name) => {
    const normalizedName = normalizeDeviceName(name);
    if (!normalizedName) {
      throw new Error('Enter a mobile name.');
    }

    const previousPairing = pairingDataRef.current;
    const nextPairing = {
      ...previousPairing,
      deviceName: normalizedName,
    };
    applyPairingData(nextPairing);
    await AsyncStorage.setItem(PAIRING_KEY, JSON.stringify(nextPairing));

    if (
      nextPairing.paired &&
      isSessionValid(sessionRef.current) &&
      websocketService.getStatus() === 'connected'
    ) {
      websocketService.sendDeviceUpdate({
        requestId: Crypto.randomUUID(),
        timestamp: Date.now(),
        deviceId: nextPairing.deviceId,
        deviceName: normalizedName,
        sessionToken: sessionRef.current.sessionToken,
      });
    }

    return nextPairing;
  }, [applyPairingData]);

  const saveOpenXProfile = useCallback(async (profile) => {
    const normalized = applyOpenXProfile(profile);
    if (settingsRef.current.connectionMode === 'cloud') {
      sendCloudProfileSync('upsert', normalized);
    }
    return normalized;
  }, [applyOpenXProfile, sendCloudProfileSync]);

  const upsertScheduleItem = useCallback(async (schedule) => {
    const normalized = normalizeScheduleItem({
      ...schedule,
      sourceDeviceId: pairingDataRef.current.deviceId,
      sourceDeviceName: pairingDataRef.current.deviceName,
      updatedAt: new Date().toISOString(),
    });
    if (!normalized) {
      throw new Error('Enter a valid schedule item.');
    }

    const merged = mergeScheduleItems(scheduleItemsRef.current, [normalized]);
    scheduleItemsRef.current = merged;
    setScheduleItems(merged);
    await persistSchedules(merged);
    markScheduleDirty(normalized.id);

    if (settingsRef.current.connectionMode === 'cloud') {
      sendCloudScheduleSync('upsert', normalized);
      return normalized;
    }

    if (
      websocketService.getStatus() === 'connected' &&
      pairingDataRef.current.paired &&
      isSessionValid(sessionRef.current)
    ) {
      websocketService.sendScheduleUpsert({
        requestId: Crypto.randomUUID(),
        timestamp: Date.now(),
        deviceId: pairingDataRef.current.deviceId,
        deviceName: pairingDataRef.current.deviceName,
        sessionToken: sessionRef.current.sessionToken,
        schedule: normalized,
      });
    }
    return normalized;
  }, [markScheduleDirty, sendCloudScheduleSync]);

  const removeScheduleItem = useCallback(async (scheduleId) => {
    const id = String(scheduleId || '').trim();
    if (!id) return false;
    const existing = scheduleItemsRef.current.find((item) => item.id === id || item.taskName === id);
    if (!existing) return false;
    const completed = normalizeScheduleItem({
      ...existing,
      status: 'completed',
      updatedAt: new Date().toISOString(),
      sourceDeviceId: pairingDataRef.current.deviceId,
      sourceDeviceName: pairingDataRef.current.deviceName,
    });
    if (!completed) return false;

    const merged = mergeScheduleItems(scheduleItemsRef.current, [completed]);
    scheduleItemsRef.current = merged;
    setScheduleItems(merged);
    await persistSchedules(merged);
    await cancelLocalScheduleNotification(completed.id);
    markScheduleDirty(completed.id);

    if (settingsRef.current.connectionMode === 'cloud') {
      sendCloudScheduleSync('upsert', completed);
      return true;
    }

    if (
      websocketService.getStatus() === 'connected' &&
      pairingDataRef.current.paired &&
      isSessionValid(sessionRef.current)
    ) {
      websocketService.sendScheduleUpsert({
        requestId: Crypto.randomUUID(),
        timestamp: Date.now(),
        deviceId: pairingDataRef.current.deviceId,
        deviceName: pairingDataRef.current.deviceName,
        sessionToken: sessionRef.current.sessionToken,
        schedule: completed,
      });
    }
    return true;
  }, [cancelLocalScheduleNotification, markScheduleDirty, sendCloudScheduleSync]);

  const sendFile = useCallback(
    async (file) => {
      const pairingData = pairingDataRef.current;

      if (settingsRef.current.connectionMode === 'cloud') {
        if (!pairingData.paired) {
          throw new Error('Pair device before transferring files.');
        }
        if (!relayClient.isConnected()) {
          throw new Error('Connect to OpenX Relay before transferring files.');
        }
        const record = await cloudFileTransferRef.current?.sendFile(file);
        if (!record) throw new Error('Cloud file transfer is unavailable.');
        return record;
      }

      if (!pairingData.paired) {
        throw new Error('Pair device before transferring files.');
      }

      if (!permissionsRef.current.fileTransfer) {
        throw new Error('File transfers disabled by desktop.');
      }

      if (!permissionsRef.current.sendFiles) {
        throw new Error('Sending files disabled by desktop.');
      }

      if (!isSessionValid(sessionRef.current)) {
        setSessionValid(false);
        throw new Error('Session expired. Please reconnect.');
      }

      if (websocketService.getStatus() !== 'connected') {
        throw new Error(
          'Connection lost. Reconnect to OpenX Desktop and try again.',
        );
      }

      try {
        const outgoingFile = await prepareOutgoingFile(file);
        if (!permissionsRef.current.fileTransfer) {
          throw new Error('File transfers disabled by desktop.');
        }
        if (!permissionsRef.current.sendFiles) {
          throw new Error('Sending files disabled by desktop.');
        }
        const sent = await websocketService.sendFileTransfer({
          requestId: Crypto.randomUUID(),
          timestamp: Date.now(),
          deviceId: pairingData.deviceId,
          sessionToken: sessionRef.current.sessionToken,
          ...outgoingFile,
        });

        if (!sent) {
          throw new Error(
            'Transfer failed. Reconnect to OpenX Desktop and try again.',
          );
        }

        return recordTransfer(
          createTransferRecord({
            direction: 'sent',
            fileName: outgoingFile.fileName,
            fileSize: outgoingFile.fileSize,
            status: 'sent',
          }),
        );
      } catch (error) {
        recordTransfer(
          createTransferRecord({
            direction: 'sent',
            fileName: file?.fileName,
            fileSize: file?.fileSize,
            status: 'failed',
            error: error.message,
          }),
        );
        throw error;
      }
    },
    [recordTransfer],
  );

  const deleteReceivedFile = useCallback(async (recordId) => {
    const target = transferHistoryRef.current.find(
      (item) => item.id === recordId,
    );
    if (!target) {
      throw new Error('File record was not found.');
    }

    if (target.direction === 'received' && target.localUri) {
      await removeReceivedFile(target);
    }

    const nextHistory = transferHistoryRef.current.filter(
      (item) => item.id !== recordId,
    );
    transferHistoryRef.current = nextHistory;
    setTransferHistory(nextHistory);
    await persistTransferHistory(nextHistory);
    return true;
  }, []);

  const clearTransferEvent = useCallback(() => {
    setLastTransferEvent(null);
  }, []);

  const value = useMemo(
    () => ({
      messages,
      connectionStatus,
      connectionMode,
      cloudStatus,
      cloudPresence,
      cloudSettings,
      remoteTargets,
      remoteControlStatus,
      remoteControlBusy,
      desktopAddress,
      desktopPort,
      settingsLoaded,
      deviceId,
      deviceName,
      openXProfile,
      paired,
      pairedAt,
      pairingLoaded,
      transferHistory,
      transfersLoaded,
      lastTransferEvent,
      permissions,
      permissionsLastUpdated,
      permissionsLoaded,
      scheduleItems,
      schedulesLoaded,
      scheduleLastSyncedAt,
      sessionValid,
      sessionLoaded,
      sendMessage,
      pairCloudDevice,
      updateDeviceName,
      saveOpenXProfile,
      upsertScheduleItem,
      removeScheduleItem,
      requestScheduleSync,
      refreshRemoteTargets,
      sendRemoteControl,
      sendFile,
      deleteReceivedFile,
      clearTransferEvent,
      showNotice,
      setConnectionMode,
      saveCloudSettings,
      connectCloud,
      disconnectCloud,
      reconnectActiveConnection,
    }),
    [
      messages,
      connectionStatus,
      connectionMode,
      cloudStatus,
      cloudPresence,
      cloudSettings,
      remoteTargets,
      remoteControlStatus,
      remoteControlBusy,
      desktopAddress,
      desktopPort,
      settingsLoaded,
      deviceId,
      deviceName,
      openXProfile,
      paired,
      pairedAt,
      pairingLoaded,
      transferHistory,
      transfersLoaded,
      lastTransferEvent,
      permissions,
      permissionsLastUpdated,
      permissionsLoaded,
      scheduleItems,
      schedulesLoaded,
      scheduleLastSyncedAt,
      sessionValid,
      sessionLoaded,
      sendMessage,
      pairCloudDevice,
      updateDeviceName,
      saveOpenXProfile,
      upsertScheduleItem,
      removeScheduleItem,
      requestScheduleSync,
      refreshRemoteTargets,
      sendRemoteControl,
      sendFile,
      deleteReceivedFile,
      clearTransferEvent,
      showNotice,
      setConnectionMode,
      saveCloudSettings,
      connectCloud,
      disconnectCloud,
      reconnectActiveConnection,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <OpenXNotice notice={notice} onDismiss={dismissNotice} />
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppProvider.');
  }
  return context;
}
