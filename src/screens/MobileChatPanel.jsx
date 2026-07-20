import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import SegmentedSlider from '../components/SegmentedSlider';
import AccountService from '../chat/accounts/AccountService';
import { fromBase64, text as decodeUtf8 } from '../chat/crypto/Encoding';
import { colors, radius, shadows, spacing } from '../styles/theme';

const DEFAULT_CHAT_API = 'https://openx-chat-server.onrender.com';
const CHAT_SESSION_KEY = '@openx-mobile/chat/session-v1';
const CHAT_MESSAGES_KEY = '@openx-mobile/chat/messages-v1';
const CHAT_PINNED_KEY = '@openx-mobile/chat/pinned-v1';
const CHAT_SYNC_KEY = '@openx-mobile/chat/sync-v1';
const CHAT_DEVICE_KEY = '@openx-mobile/chat/device-key-v1';
const MAX_RELATIONSHIP_MESSAGES = 200;
const CHAT_SYNC_INTERVAL_MS = 15000;
const MESSAGE_RUNTIME_ERROR = 'Secure chat runtime is unavailable on this device build.';
const CHAT_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Pinned', value: 'pinned' },
];

const emptyChatState = {
  account: null,
  device: null,
  apiBaseUrl: DEFAULT_CHAT_API,
  username: '',
};

export const MOBILE_CHAT_STORAGE_KEYS = Object.freeze([
  CHAT_SESSION_KEY,
  CHAT_MESSAGES_KEY,
  CHAT_PINNED_KEY,
  CHAT_SYNC_KEY,
]);

export async function clearMobileChatStorage() {
  await AsyncStorage.multiRemove(MOBILE_CHAT_STORAGE_KEYS);
}

const parseJson = (value, fallback) => {
  try {
    const parsed = JSON.parse(value || '');
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const normalizeServerUrl = (value) => {
  const url = String(value || DEFAULT_CHAT_API).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) throw new Error('Server URL must start with http:// or https://.');
  return url;
};

const accountIdFromRelationship = (relationship, ownAccountId) => {
  if (!relationship) return '';
  return relationship.accountA === ownAccountId ? relationship.accountB : relationship.accountA;
};

const relationshipTitle = (relationship, ownAccountId) => {
  const metadata = relationship?.metadata || {};
  const label = metadata.nickname || metadata.username || metadata.displayName || accountIdFromRelationship(relationship, ownAccountId);
  return String(label || 'OpenX user').replace(/\s+/g, ' ').trim();
};

const normalizeMessageDirection = (value) => (value === 'incoming' ? 'incoming' : 'outgoing');

const makeLocalMessage = (input = {}) => {
  const relationshipId = String(input.relationshipId || '').trim();
  if (!relationshipId) return null;
  return {
    id: String(input.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`).slice(0, 96),
    relationshipId,
    direction: normalizeMessageDirection(input.direction),
    text: String(input.text || '').replace(/\s+/g, ' ').trim().slice(0, 2000),
    status: String(input.status || 'sent').slice(0, 40),
    createdAt: Number.isFinite(Date.parse(input.createdAt)) ? input.createdAt : new Date().toISOString(),
  };
};

const formatMessageTime = (value) => {
  const date = new Date(value || Date.now());
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const normalizeMessageStatusLabel = (value) => {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'failed') return 'Failed';
  if (status === 'queued') return 'Queued';
  if (status === 'sending') return 'Sending';
  return '';
};

const messageStatusIcon = (value) => {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'failed') return 'alert-circle';
  if (status === 'queued' || status === 'sending') return 'time-outline';
  if (status === 'delivered' || status === 'read') return 'checkmark-done';
  return 'checkmark';
};

const messageStatusColor = (value) => {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'failed') return colors.danger;
  if (status === 'queued' || status === 'sending') return 'rgba(3, 5, 10, 0.45)';
  if (status === 'read') return colors.blue;
  return 'rgba(3, 5, 10, 0.54)';
};

const pruneMessagesByRelationship = (messages = {}) => {
  if (!messages || typeof messages !== 'object' || Array.isArray(messages)) return {};
  return Object.fromEntries(
    Object.entries(messages).map(([relationshipId, items]) => [
      relationshipId,
      Array.isArray(items)
        ? items.map((item) => makeLocalMessage({ ...item, relationshipId: item?.relationshipId || relationshipId })).filter(Boolean).slice(-MAX_RELATIONSHIP_MESSAGES)
        : [],
    ]),
  );
};

const normalizePinnedRelationships = (value) => (
  Array.isArray(value) ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 20) : []
);

const normalizeSyncCursor = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([deviceId, sequence]) => [
    String(deviceId || '').trim(),
    Math.max(0, Number(sequence || 0)),
  ]).filter(([deviceId, sequence]) => deviceId && Number.isFinite(sequence)));
};

const decodeBase64UrlText = (value) => {
  try {
    return decodeUtf8(fromBase64(value));
  } catch {
    return '';
  }
};

const legacyPreviewFromEnvelope = (envelope = {}) => {
  const metadata = envelope.metadata || {};
  const direct = String(metadata.notificationPreview || metadata.messagePreview || metadata.preview || metadata.bodyPreview || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
  if (direct) return direct;

  const packetText = String(envelope.ciphertext || '').trim().startsWith('{')
    ? String(envelope.ciphertext || '')
    : decodeBase64UrlText(envelope.ciphertext);
  if (!packetText) return '';
  try {
    const packet = JSON.parse(packetText);
    if (!packet || typeof packet !== 'object' || packet.keyScope !== 'local-device-preview') return '';
    const encodedPreview = String(packet.notificationPreview || '').trim();
    const preview = encodedPreview ? decodeBase64UrlText(encodedPreview) : String(packet.preview || packet.messagePreview || packet.text || '');
    return preview.replace(/\s+/g, ' ').trim().slice(0, 240);
  } catch {
    return '';
  }
};

const normalizeChatSession = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyChatState;
  const account = value.account && typeof value.account === 'object' ? value.account : null;
  const device = value.device && typeof value.device === 'object' ? value.device : null;
  return {
    ...emptyChatState,
    ...value,
    account,
    device,
    apiBaseUrl: value.apiBaseUrl || DEFAULT_CHAT_API,
    username: String(value.username || account?.username || '').trim(),
  };
};

const mergeRelationshipMessages = (current = {}, additions = []) => {
  if (!additions.length) return current;
  const next = { ...current };
  for (const message of additions) {
    if (!message?.relationshipId || !message?.id) continue;
    const existing = next[message.relationshipId] || [];
    const index = existing.findIndex((item) => item.id === message.id);
    if (index >= 0) {
      next[message.relationshipId] = existing.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...message } : item
      ));
    } else {
      next[message.relationshipId] = [...existing, message];
    }
  }
  return pruneMessagesByRelationship(next);
};

const localMessageFromEnvelope = (envelope = {}, accountId = '', received = null) => {
  const message = received?.message || {};
  const metadata = envelope.metadata || message.metadata || {};
  const relationshipId = message.relationshipId || metadata.relationshipId;
  if (!relationshipId) return null;
  const senderAccountId = message.senderAccountId || metadata.senderAccountId || '';
  const plaintext = typeof received?.plaintext === 'string' ? received.plaintext : '';
  const fallbackPreview = legacyPreviewFromEnvelope(envelope);
  return makeLocalMessage({
    id: message.messageId || envelope.messageId,
    relationshipId,
    direction: senderAccountId && senderAccountId === accountId ? 'outgoing' : 'incoming',
    text: plaintext || fallbackPreview || 'Encrypted message',
    status: message.status || envelope.deliveryStatus || 'delivered',
    createdAt: message.timestamp || envelope.createdAt,
  });
};

const normalizeChatAccountId = (value) => {
  const accountId = String(value || '').trim().toLowerCase();
  return /^acc_[a-f0-9]{64}$/.test(accountId) ? accountId : '';
};

const relationshipSessionSeed = (context = {}) => {
  const envelopeMetadata = context.envelope?.metadata || {};
  const metadata = context.metadata || envelopeMetadata;
  const relationshipId = String(context.relationshipId || metadata.relationshipId || '').trim().toLowerCase();
  const relationship = context.relationship && typeof context.relationship === 'object' ? context.relationship : {};
  const accountIds = [...new Set([
    context.senderAccountId || metadata.senderAccountId,
    context.recipientAccountId || metadata.recipientAccountId,
  ].map(normalizeChatAccountId).filter(Boolean))];
  if (accountIds.length < 2) {
    [
      relationship.accountA,
      relationship.accountB,
      context.accountId,
      metadata.peerAccountId,
    ].map(normalizeChatAccountId)
      .filter(Boolean)
      .forEach((id) => {
        if (!accountIds.includes(id)) accountIds.push(id);
      });
  }
  if (!relationshipId || accountIds.length < 2) return null;
  return `OpenXChat:relationship-session:v1:${relationshipId}:${accountIds.slice(0, 2).sort().join(':')}`;
};

export async function resolveRelationshipSessionKey(context = {}) {
  const seed = relationshipSessionSeed(context);
  if (!seed) return null;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed);
}

class MobileChatErrorBoundary extends Component {
  state = { error: null, resetCount: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    this.props.showNotice?.({
      title: 'Chat needs to recover',
      message: error?.message || 'The chat view hit an unexpected error.',
      tone: 'error',
    });
  }

  recover = async () => {
    await clearMobileChatStorage();
    this.setState((current) => ({ error: null, resetCount: current.resetCount + 1 }));
  };

  render() {
    if (!this.state.error) {
      return (
        <MobileChatPanelContent
          key={this.state.resetCount}
          {...this.props}
        />
      );
    }
    return (
      <View style={[styles.container, styles.recoveryPanel, { paddingTop: this.props.topPadding, paddingBottom: this.props.bottomPadding }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Chat needs to recover</Text>
          <Text style={styles.emptyText}>Local chat state will be reset. Your server account and accepted contacts remain available after signing in.</Text>
          <Pressable accessibilityRole="button" onPress={this.recover} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Restart Chat</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

export default function MobileChatPanel(props) {
  return <MobileChatErrorBoundary {...props} />;
}

function MobileChatPanelContent({ bottomPadding = 0, deviceName, showNotice, topPadding = 0 }) {
  const [session, setSession] = useState(emptyChatState);
  const [serverUrl, setServerUrl] = useState(DEFAULT_CHAT_API);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [relationships, setRelationships] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [messagesByRelationship, setMessagesByRelationship] = useState({});
  const [pinnedRelationships, setPinnedRelationships] = useState([]);
  const [activeRelationshipId, setActiveRelationshipId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const messageManagerRef = useRef(null);
  const messagesByRelationshipRef = useRef({});
  const relationshipsRef = useRef([]);
  const syncCursorRef = useRef({});
  const syncingRef = useRef(false);

  const apiBaseUrl = session.apiBaseUrl || serverUrl || DEFAULT_CHAT_API;
  const accountId = session.account?.accountId || '';
  const activeRelationship = useMemo(
    () => relationships.find((item) => item.relationshipId === activeRelationshipId) || null,
    [activeRelationshipId, relationships],
  );

  const accountService = useMemo(() => new AccountService({ apiBaseUrl }), [apiBaseUrl]);

  const persistSession = useCallback(async (nextSession) => {
    const normalized = normalizeChatSession(nextSession);
    setSession(normalized);
    setServerUrl(normalized.apiBaseUrl || DEFAULT_CHAT_API);
    setUsername(normalized.username || normalized.account?.username || '');
    await AsyncStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(normalized));
  }, []);

  const persistMessages = useCallback(async (nextMessages) => {
    const normalized = pruneMessagesByRelationship(nextMessages);
    messagesByRelationshipRef.current = normalized;
    setMessagesByRelationship(normalized);
    await AsyncStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(normalized));
  }, []);

  const persistPinned = useCallback(async (nextPinned) => {
    const normalized = normalizePinnedRelationships(nextPinned);
    setPinnedRelationships(normalized);
    await AsyncStorage.setItem(CHAT_PINNED_KEY, JSON.stringify(normalized));
  }, []);

  const persistSyncCursor = useCallback(async (nextCursor) => {
    const normalized = normalizeSyncCursor(nextCursor);
    syncCursorRef.current = normalized;
    await AsyncStorage.setItem(CHAT_SYNC_KEY, JSON.stringify(normalized));
  }, []);

  useEffect(() => {
    relationshipsRef.current = relationships;
  }, [relationships]);

  const loadLocalChat = useCallback(async () => {
    const [[, savedSession], [, savedMessages], [, savedPinned], [, savedSync]] = await AsyncStorage.multiGet([
      CHAT_SESSION_KEY,
      CHAT_MESSAGES_KEY,
      CHAT_PINNED_KEY,
      CHAT_SYNC_KEY,
    ]);
    const parsedSession = normalizeChatSession(parseJson(savedSession, emptyChatState));
    const parsedMessages = parseJson(savedMessages, {});
    const parsedPinned = normalizePinnedRelationships(parseJson(savedPinned, []));
    const parsedSync = normalizeSyncCursor(parseJson(savedSync, {}));
    setSession(parsedSession);
    setServerUrl(parsedSession.apiBaseUrl || DEFAULT_CHAT_API);
    setUsername(parsedSession.username || parsedSession.account?.username || '');
    const normalizedMessages = pruneMessagesByRelationship(parsedMessages);
    messagesByRelationshipRef.current = normalizedMessages;
    setMessagesByRelationship(normalizedMessages);
    setPinnedRelationships(parsedPinned);
    syncCursorRef.current = parsedSync;
    setLoaded(true);
  }, []);

  const getClientDeviceKey = useCallback(async () => {
    const existing = await AsyncStorage.getItem(CHAT_DEVICE_KEY);
    if (existing) return existing;
    const next = Crypto.randomUUID();
    await AsyncStorage.setItem(CHAT_DEVICE_KEY, next);
    return next;
  }, []);

  const registerDevice = useCallback(async (service, account) => {
    const createDevice = (clientDeviceKey) => service.registerDevice({
      accountId: account.accountId,
      deviceName: `${String(deviceName || 'OpenX Mobile').slice(0, 64)} Chat`,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      platformVersion: String(Platform.Version || '').slice(0, 80),
      applicationVersion: '3.0.0',
      operatingSystem: Platform.OS,
      deviceType: 'Mobile',
      capabilities: [
        'persistentConnection',
        'backgroundWake',
        'batteryOptimization',
        'foregroundService',
      ],
      metadata: {
        client: 'openx-mobile',
        surface: 'chat',
      },
      clientDeviceKey,
    });
    const clientDeviceKey = await getClientDeviceKey();
    try {
      return await createDevice(clientDeviceKey);
    } catch (error) {
      if (error.code !== 'device.duplicate') throw error;
      const replacementKey = Crypto.randomUUID();
      await AsyncStorage.setItem(CHAT_DEVICE_KEY, replacementKey);
      return createDevice(replacementKey);
    }
  }, [deviceName, getClientDeviceKey]);

  const refreshChat = useCallback(async () => {
    if (!accountId) return;
    setRefreshing(true);
    try {
      const [incoming, outgoing, trusted] = await Promise.all([
        accountService.listIncomingRequests(accountId),
        accountService.listOutgoingRequests(accountId),
        accountService.listRelationships(accountId),
      ]);
      const trustedRelationships = Array.isArray(trusted?.relationships) ? trusted.relationships : [];
      const enrichedRelationships = await Promise.all(trustedRelationships.map(async (relationship) => {
        const otherAccountId = accountIdFromRelationship(relationship, accountId);
        try {
          const account = await accountService.getAccount(otherAccountId);
          return {
            ...relationship,
            metadata: {
              ...(relationship.metadata || {}),
              username: account?.username || relationship.metadata?.username,
            },
          };
        } catch {
          return relationship;
        }
      }));
      relationshipsRef.current = enrichedRelationships;
      setIncomingRequests(Array.isArray(incoming?.requests) ? incoming.requests : []);
      setOutgoingRequests(Array.isArray(outgoing?.requests) ? outgoing.requests : []);
      setRelationships(enrichedRelationships);
      return enrichedRelationships;
    } catch (error) {
      showNotice?.({ title: 'Chat refresh failed', message: error.message, tone: 'error' });
      return relationshipsRef.current;
    } finally {
      setRefreshing(false);
    }
  }, [accountId, accountService, showNotice]);

  useEffect(() => {
    loadLocalChat().catch((error) => {
      setLoaded(true);
      showNotice?.({ title: 'Chat load failed', message: error.message, tone: 'error' });
    });
  }, [loadLocalChat, showNotice]);

  const handleAuth = useCallback(async (mode = authMode) => {
    setBusy(true);
    try {
      const normalizedUrl = normalizeServerUrl(serverUrl);
      const service = new AccountService({ apiBaseUrl: normalizedUrl });
      const account = mode === 'register'
        ? await service.register({ username, password })
        : await service.login({ username, password });
      const deviceResult = await registerDevice(service, account);
      const nextSession = {
        account,
        device: deviceResult.device,
        deviceRegistration: deviceResult,
        apiBaseUrl: normalizedUrl,
        username: account.username || username,
        signedInAt: new Date().toISOString(),
      };
      await persistSession(nextSession);
      setPassword('');
      showNotice?.({
        title: mode === 'register' ? 'Chat account created' : 'Signed in',
        message: 'OpenX Chat is ready on this mobile.',
        tone: 'success',
      });
    } catch (error) {
      showNotice?.({ title: 'Chat setup failed', message: error.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }, [authMode, password, persistSession, registerDevice, serverUrl, showNotice, username]);

  const handleSignOut = useCallback(async () => {
    await clearMobileChatStorage();
    setSession(emptyChatState);
    setPassword('');
    setSearch('');
    setAddUsername('');
    setAddOpen(false);
    setRelationships([]);
    relationshipsRef.current = [];
    setIncomingRequests([]);
    setOutgoingRequests([]);
    setActiveRelationshipId('');
    messageManagerRef.current = null;
    messagesByRelationshipRef.current = {};
    syncCursorRef.current = {};
    setMessagesByRelationship({});
    setPinnedRelationships([]);
  }, []);

  const handleAddUser = useCallback(async () => {
    if (!accountId) return;
    setBusy(true);
    try {
      const lookup = await accountService.lookupUser({ username: addUsername, metadata: { requester: session.username || 'mobile' } });
      const request = await accountService.createContactRequest({
        senderAccountId: accountId,
        opaqueContactToken: lookup.opaqueContactToken,
        messagePreview: `${session.username || 'OpenX user'} wants to chat.`,
        metadata: { source: 'mobile-chat' },
      });
      setAddUsername('');
      setAddOpen(false);
      showNotice?.({ title: 'Request sent', message: 'The user can accept your chat request.', tone: 'success' });
      await refreshChat();
      if (request.relationship?.relationshipId) setActiveRelationshipId(request.relationship.relationshipId);
    } catch (error) {
      showNotice?.({ title: 'Unable to add user', message: error.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }, [accountId, accountService, addUsername, refreshChat, session.username, showNotice]);

  const handleAcceptRequest = useCallback(async (requestId) => {
    setBusy(true);
    try {
      const result = await accountService.acceptRequest({ accountId, requestId });
      await refreshChat();
      if (result.relationship?.relationshipId) setActiveRelationshipId(result.relationship.relationshipId);
      showNotice?.({ title: 'Request accepted', message: 'A chat is ready.', tone: 'success' });
    } catch (error) {
      showNotice?.({ title: 'Unable to accept', message: error.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }, [accountId, accountService, refreshChat, showNotice]);

  const handleDeleteRequest = useCallback(async (requestId) => {
    setBusy(true);
    try {
      await accountService.deleteRequest({ accountId, requestId, reason: 'mobile_user_deleted' });
      await refreshChat();
    } catch (error) {
      showNotice?.({ title: 'Unable to remove request', message: error.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }, [accountId, accountService, refreshChat, showNotice]);

  const togglePinned = useCallback(async (relationshipId) => {
    const nextPinned = pinnedRelationships.includes(relationshipId)
      ? pinnedRelationships.filter((id) => id !== relationshipId)
      : [relationshipId, ...pinnedRelationships].slice(0, 20);
    await persistPinned(nextPinned);
  }, [persistPinned, pinnedRelationships]);

  const filteredRelationships = useMemo(() => {
    const query = search.trim().toLowerCase();
    return relationships.filter((relationship) => {
      const localMessages = messagesByRelationship[relationship.relationshipId] || [];
      const unread = localMessages.some((message) => message.direction === 'incoming' && message.status !== 'read');
      const pinned = pinnedRelationships.includes(relationship.relationshipId);
      if (filter === 'unread' && !unread) return false;
      if (filter === 'pinned' && !pinned) return false;
      if (!query) return true;
      return relationshipTitle(relationship, accountId).toLowerCase().includes(query);
    });
  }, [accountId, filter, messagesByRelationship, pinnedRelationships, relationships, search]);

  const activeMessages = activeRelationship
    ? messagesByRelationship[activeRelationship.relationshipId] || []
    : [];

  const getMessageManager = useCallback(() => {
    if (!messageManagerRef.current || messageManagerRef.current.config.apiBaseUrl !== apiBaseUrl) {
      try {
        const MessageManager = require('../chat/messages/MessageManager').default;
        messageManagerRef.current = new MessageManager({
          config: {
            apiBaseUrl,
            requireSessionKey: true,
            allowEphemeralSessionKey: false,
            requestTimeoutMs: 15000,
          },
          sessionResolver: resolveRelationshipSessionKey,
        });
      } catch (error) {
        const runtimeError = new Error(MESSAGE_RUNTIME_ERROR);
        runtimeError.cause = error;
        throw runtimeError;
      }
    }
    return messageManagerRef.current;
  }, [apiBaseUrl]);

  const syncChatMessages = useCallback(async ({ silent = true, relationshipsOverride = null } = {}) => {
    const deviceId = session.device?.deviceId || '';
    if (!accountId || !deviceId || syncingRef.current) return 0;
    syncingRef.current = true;
    try {
      const cursorSnapshot = syncCursorRef.current || {};
      const afterSequence = Number(cursorSnapshot[deviceId] || 0);
      const sync = await accountService.request(
        `/sync?deviceId=${encodeURIComponent(deviceId)}&afterSequence=${encodeURIComponent(String(afterSequence))}&limit=50`,
        'GET',
      );
      const envelopes = Array.isArray(sync?.envelopes) ? sync.envelopes : [];
      if (!envelopes.length) return 0;

      const manager = getMessageManager();
      const additions = [];
      const relationshipList = Array.isArray(relationshipsOverride) ? relationshipsOverride : relationshipsRef.current;
      let highestSequence = afterSequence;
      for (const envelope of envelopes) {
        highestSequence = Math.max(highestSequence, Number(envelope.mailboxSequence || 0));
        const relationshipId = String(envelope.metadata?.relationshipId || envelope.relationshipId || '').trim();
        const relationship = relationshipList.find((item) => item.relationshipId === relationshipId) || null;
        try {
          const received = await manager.receiveEnvelope({ accountId, deviceId, envelope, relationship });
          const message = localMessageFromEnvelope(envelope, accountId, received);
          if (message) additions.push(message);
        } catch {
          const fallback = localMessageFromEnvelope(envelope, accountId);
          if (fallback) additions.push(fallback);
        }
      }

      if (additions.length) {
        const merged = mergeRelationshipMessages(messagesByRelationshipRef.current, additions);
        await persistMessages(merged);
      }

      if (highestSequence > afterSequence) {
        await accountService.request('/sync/ack', 'POST', {
          deviceId,
          highestContiguousSequence: highestSequence,
        });
        await persistSyncCursor({ ...cursorSnapshot, [deviceId]: highestSequence });
      }
      return additions.length;
    } catch (error) {
      if (!silent) showNotice?.({ title: 'Chat sync failed', message: error.message, tone: 'error' });
      return 0;
    } finally {
      syncingRef.current = false;
    }
  }, [
    accountId,
    accountService,
    getMessageManager,
    persistMessages,
    persistSyncCursor,
    session.device?.deviceId,
    showNotice,
  ]);

  const refreshChatWithSync = useCallback(async (options = {}) => {
    const latestRelationships = await refreshChat();
    return syncChatMessages({ ...options, relationshipsOverride: latestRelationships });
  }, [refreshChat, syncChatMessages]);

  useEffect(() => {
    if (loaded && accountId) refreshChatWithSync({ silent: true });
  }, [accountId, loaded, refreshChatWithSync]);

  useEffect(() => {
    if (!loaded || !accountId) return undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshChatWithSync({ silent: true });
    });
    return () => subscription.remove();
  }, [accountId, loaded, refreshChatWithSync]);

  useEffect(() => {
    if (!loaded || !accountId) return undefined;
    const timer = setInterval(() => {
      refreshChatWithSync({ silent: true });
    }, CHAT_SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [accountId, loaded, refreshChatWithSync]);

  const sendChatMessage = useCallback(async () => {
    const text = messageText.replace(/\s+/g, ' ').trim();
    if (!text || !activeRelationship || !session.device?.deviceId || !accountId) return;
    const relationshipId = activeRelationship.relationshipId;
    const optimistic = makeLocalMessage({ relationshipId, text, status: 'sending' });
    const nextMessages = mergeRelationshipMessages(messagesByRelationshipRef.current, [optimistic]);
    await persistMessages(nextMessages);
    setMessageText('');
    try {
      const recipientAccountId = accountIdFromRelationship(activeRelationship, accountId);
      const result = await getMessageManager().sendText({
        relationshipId,
        senderAccountId: accountId,
        senderDeviceId: session.device.deviceId,
        recipientAccountId,
        recipientDeviceId: null,
        plaintext: text,
        metadata: {
          source: 'mobile-chat',
          priority: 'Normal',
        },
      });
      const sent = {
        ...optimistic,
        id: result.message?.messageId || optimistic.id,
        status: Number(result.delivery?.result?.deliveredCount || result.delivery?.deliveredCount || 0) > 0
          ? 'delivered'
          : (result.delivery?.transport === 'local-queue' ? 'queued' : 'sent'),
      };
      await persistMessages({
        ...nextMessages,
        [relationshipId]: nextMessages[relationshipId].map((message) => (
          message.id === optimistic.id ? sent : message
        )),
      });
      syncChatMessages({ silent: true });
    } catch (error) {
      await persistMessages({
        ...nextMessages,
        [relationshipId]: nextMessages[relationshipId].map((message) => (
          message.id === optimistic.id ? { ...message, status: 'failed' } : message
        )),
      });
      showNotice?.({ title: 'Message not sent', message: error.message, tone: 'error' });
    }
  }, [
    accountId,
    activeRelationship,
    getMessageManager,
    messageText,
    persistMessages,
    session.device?.deviceId,
    showNotice,
    syncChatMessages,
  ]);

  if (!loaded) {
    return (
      <View style={[styles.container, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!accountId) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
        <View style={styles.authPanel}>
          <Text style={styles.title}>OpenX Chat</Text>
          <Text style={styles.subtitle}>Use your OpenX username and password to message real users.</Text>
          <SegmentedSlider
            accessibilityLabel="Chat setup mode"
            onChange={setAuthMode}
            options={[
              { label: 'Sign In', value: 'login' },
              { label: 'Create', value: 'register' },
            ]}
            style={styles.authMode}
            value={authMode}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={setServerUrl}
            placeholder="https://openx-chat-server.onrender.com"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={serverUrl}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={33}
            onChangeText={setUsername}
            placeholder="@username"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={username}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <Text style={styles.authHint}>
            Password needs 10+ characters with uppercase, lowercase, number, and symbol.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => handleAuth(authMode)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}
          >
            {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonText}>{authMode === 'register' ? 'Create account' : 'Sign in'}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (activeRelationship) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
        <View style={styles.threadHeader}>
          <Pressable
            accessibilityLabel="Back to chat list"
            accessibilityRole="button"
            onPress={() => setActiveRelationshipId('')}
            style={styles.iconButton}
          >
            <Ionicons color={colors.text} name="chevron-back" size={22} />
          </Pressable>
          <View>
            <Text numberOfLines={1} style={styles.threadTitle}>{relationshipTitle(activeRelationship, accountId)}</Text>
            <Text style={styles.threadMeta}>{activeMessages.length} messages</Text>
          </View>
        </View>
        <FlatList
          contentContainerStyle={styles.threadList}
          data={activeMessages}
          initialNumToRender={18}
          keyExtractor={(item) => item.id}
          maxToRenderPerBatch={8}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={({ item }) => {
            const outgoing = item.direction === 'outgoing';
            const statusLabel = outgoing ? normalizeMessageStatusLabel(item.status) : '';
            return (
              <View style={[styles.messageRow, outgoing ? styles.messageRowOutgoing : styles.messageRowIncoming]}>
                <View style={[styles.messageBubble, outgoing ? styles.messageOutgoing : styles.messageIncoming]}>
                  <Text style={[styles.messageText, outgoing ? styles.messageTextOutgoing : styles.messageTextIncoming]}>{item.text}</Text>
                  <View style={[styles.messageMetaRow, outgoing ? styles.messageMetaOutgoing : styles.messageMetaIncoming]}>
                    <Text style={[styles.messageTime, outgoing ? styles.messageTimeOutgoing : styles.messageTimeIncoming]}>{formatMessageTime(item.createdAt)}</Text>
                    {statusLabel ? (
                      <Text style={[styles.messageStatus, outgoing ? styles.messageStatusOutgoing : styles.messageStatusIncoming]}>{statusLabel}</Text>
                    ) : null}
                    {outgoing ? (
                      <Ionicons color={messageStatusColor(item.status)} name={messageStatusIcon(item.status)} size={13} />
                    ) : null}
                  </View>
                  <View pointerEvents="none" style={[styles.messageTail, outgoing ? styles.messageTailOutgoing : styles.messageTailIncoming]} />
                </View>
              </View>
            );
          }}
          showsVerticalScrollIndicator={false}
          updateCellsBatchingPeriod={48}
          windowSize={7}
        />
        <View style={styles.chatComposer}>
          <TextInput
            maxLength={2000}
            multiline
            onChangeText={setMessageText}
            placeholder="Message"
            placeholderTextColor={colors.textMuted}
            style={styles.chatInput}
            value={messageText}
          />
          <Pressable
            accessibilityLabel="Send chat message"
            accessibilityRole="button"
            disabled={!messageText.trim()}
            onPress={sendChatMessage}
            style={({ pressed }) => [styles.sendButton, pressed && styles.pressed, !messageText.trim() && styles.disabled]}
          >
            <Ionicons color={colors.background} name="send" size={18} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
      <View style={styles.chatHeader}>
        <View>
          <Text style={styles.title}>OpenX Chat</Text>
          <Text style={styles.subtitle}>@{session.username || session.account?.username}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={handleSignOut} style={styles.iconButton}>
          <Ionicons color={colors.text} name="log-out-outline" size={21} />
        </Pressable>
      </View>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setSearch}
        placeholder="Search chats"
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
        value={search}
      />
      <View style={styles.filterRow}>
        <SegmentedSlider
          accessibilityLabel="Chat list filter"
          onChange={setFilter}
          options={CHAT_FILTERS}
          style={styles.filterSlider}
          value={filter}
        />
        <Pressable
          accessibilityLabel="Add OpenX user"
          accessibilityRole="button"
          onPress={() => setAddOpen((current) => !current)}
          style={styles.addButton}
        >
          <Ionicons color={colors.background} name={addOpen ? 'close' : 'add'} size={22} />
        </Pressable>
      </View>
      {addOpen ? (
        <View style={styles.addPanel}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={33}
            onChangeText={setAddUsername}
            placeholder="@username to add"
            placeholderTextColor={colors.textMuted}
            style={styles.addInput}
            value={addUsername}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy || !addUsername.trim()}
            onPress={handleAddUser}
            style={({ pressed }) => [styles.smallPrimary, pressed && styles.pressed, (busy || !addUsername.trim()) && styles.disabled]}
          >
            <Text style={styles.smallPrimaryText}>Send</Text>
          </Pressable>
        </View>
      ) : null}
      {incomingRequests.length ? (
        <View style={styles.requestsPanel}>
          <Text style={styles.sectionTitle}>Requests</Text>
          {incomingRequests.slice(0, 3).map((request) => (
            <View key={request.requestId} style={styles.requestRow}>
              <Text numberOfLines={1} style={styles.requestText}>{request.messagePreview || 'New chat request'}</Text>
              <Pressable onPress={() => handleDeleteRequest(request.requestId)} style={styles.requestAction}>
                <Ionicons color={colors.textMuted} name="close" size={18} />
              </Pressable>
              <Pressable onPress={() => handleAcceptRequest(request.requestId)} style={styles.requestAction}>
                <Ionicons color={colors.success} name="checkmark" size={20} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Chats</Text>
        <Pressable accessibilityRole="button" disabled={refreshing} onPress={() => refreshChatWithSync({ silent: false })} style={styles.refreshButton}>
          <Ionicons color={colors.textSecondary} name="refresh" size={18} />
        </Pressable>
      </View>
      <FlatList
        contentContainerStyle={[styles.chatList, { paddingBottom: bottomPadding + spacing.xl }]}
        data={filteredRelationships}
        initialNumToRender={14}
        keyExtractor={(item) => item.relationshipId}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{outgoingRequests.length ? 'Waiting for approval' : 'No chats yet'}</Text>
            <Text style={styles.emptyText}>{outgoingRequests.length ? 'Your sent request appears here until it is accepted.' : 'Tap + and add a username to start.'}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const title = relationshipTitle(item, accountId);
          const localMessages = messagesByRelationship[item.relationshipId] || [];
          const last = localMessages[localMessages.length - 1];
          const pinned = pinnedRelationships.includes(item.relationshipId);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveRelationshipId(item.relationshipId)}
              style={({ pressed }) => [styles.chatRow, pressed && styles.pressed]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{title.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.chatRowText}>
                <Text numberOfLines={1} style={styles.chatName}>{title}</Text>
                <Text numberOfLines={1} style={styles.chatPreview}>{last?.text || 'Trusted OpenX user'}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => togglePinned(item.relationshipId)} style={styles.pinButton}>
                <Ionicons color={pinned ? colors.warning : colors.textMuted} name={pinned ? 'bookmark' : 'bookmark-outline'} size={18} />
              </Pressable>
            </Pressable>
          );
        }}
        maxToRenderPerBatch={8}
        removeClippedSubviews={Platform.OS === 'android'}
        showsVerticalScrollIndicator={false}
        updateCellsBatchingPeriod={48}
        windowSize={7}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  recoveryPanel: {
    justifyContent: 'center',
  },
  authPanel: {
    ...shadows.floating,
    backgroundColor: colors.contentElevated,
    borderColor: colors.borderBright,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  authMode: {
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.glassSubtle,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  authHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: -spacing.xs,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.round,
    height: 52,
    justifyContent: 'center',
    minWidth: 190,
    paddingHorizontal: spacing.xl,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.45,
  },
  chatHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderBright,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  searchInput: {
    backgroundColor: colors.contentElevated,
    borderColor: colors.border,
    borderRadius: radius.round,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    height: 48,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  filterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterSlider: {
    flex: 1,
    minHeight: 48,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.round,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  addPanel: {
    alignItems: 'center',
    backgroundColor: colors.contentElevated,
    borderColor: colors.borderBright,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.sm,
  },
  addInput: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  smallPrimary: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.round,
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  smallPrimaryText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '900',
  },
  requestsPanel: {
    backgroundColor: colors.contentElevated,
    borderColor: colors.borderBright,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  requestRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  requestText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  requestAction: {
    alignItems: 'center',
    borderRadius: radius.round,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  refreshButton: {
    alignItems: 'center',
    borderRadius: radius.round,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  chatList: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  chatRow: {
    alignItems: 'center',
    backgroundColor: colors.contentElevated,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 76,
    paddingHorizontal: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.glassStrong,
    borderColor: colors.borderBright,
    borderRadius: radius.round,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  avatarText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  chatRowText: {
    flex: 1,
    minWidth: 0,
  },
  chatName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  chatPreview: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  pinButton: {
    alignItems: 'center',
    borderRadius: radius.round,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  threadHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  threadTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    maxWidth: 260,
  },
  threadMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  threadList: {
    flexGrow: 1,
    gap: 3,
    justifyContent: 'flex-end',
    paddingBottom: spacing.md,
    paddingHorizontal: 2,
    paddingTop: spacing.sm,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingHorizontal: 2,
    width: '100%',
  },
  messageRowOutgoing: {
    justifyContent: 'flex-end',
  },
  messageRowIncoming: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    borderRadius: 18,
    maxWidth: '82%',
    minWidth: 74,
    paddingBottom: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    position: 'relative',
  },
  messageOutgoing: {
    backgroundColor: colors.white,
    borderBottomRightRadius: 5,
    marginLeft: spacing.xl,
  },
  messageIncoming: {
    backgroundColor: 'rgba(28, 31, 42, 0.98)',
    borderBottomLeftRadius: 5,
    borderColor: colors.border,
    borderWidth: 1,
    marginRight: spacing.xl,
  },
  messageText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 21,
  },
  messageTextOutgoing: {
    color: colors.background,
  },
  messageTextIncoming: {
    color: colors.text,
  },
  messageMetaRow: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    marginLeft: spacing.lg,
    marginTop: 3,
  },
  messageMetaOutgoing: {},
  messageMetaIncoming: {},
  messageTime: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
  },
  messageTimeOutgoing: {
    color: 'rgba(3, 5, 10, 0.45)',
  },
  messageTimeIncoming: {
    color: colors.textMuted,
  },
  messageStatus: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
  messageStatusOutgoing: {
    color: 'rgba(3, 5, 10, 0.48)',
  },
  messageStatusIncoming: {
    color: colors.textMuted,
  },
  messageTail: {
    bottom: -1,
    height: 12,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 12,
  },
  messageTailOutgoing: {
    backgroundColor: colors.white,
    right: -3,
  },
  messageTailIncoming: {
    backgroundColor: 'rgba(28, 31, 42, 0.98)',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderLeftColor: colors.border,
    borderLeftWidth: 1,
    left: -3,
  },
  chatComposer: {
    alignItems: 'flex-end',
    ...shadows.floating,
    backgroundColor: colors.contentElevated,
    borderColor: colors.borderBright,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: 6,
  },
  chatInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    maxHeight: 112,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.round,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
});
