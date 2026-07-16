import packageJson from '../../package.json';
import * as Network from 'expo-network';
import { SecurePacketChannel, decryptJson, encryptJson } from './e2ee';

const CONNECTION_STATES = new Set([
  'disconnected',
  'connecting',
  'connected',
  'reconnecting',
  'disconnecting',
  'error',
]);

const DEFAULT_RELAY_URL = 'wss://openx-server.onrender.com/ws';
const LEGACY_DEFAULT_RELAY_URLS = new Set(['ws://localhost:8081/ws']);
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_HEARTBEAT_MS = 30000;
const DEFAULT_PAIR_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_QUEUE_SIZE = 100;
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 20000, 30000];
export const MOBILE_APP_VERSION = String(packageJson?.version || '1.0.0');

const createRequestId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
};

const withReconnectJitter = (delayMs) => {
  const jitter = delayMs * 0.2 * (Math.random() * 2 - 1);
  return Math.max(250, Math.round(delayMs + jitter));
};

const OFFLINE_MESSAGE = 'No internet connection. Connect to Wi-Fi or mobile data, then try again.';

async function readNetworkStatus() {
  try {
    const state = await Network.getNetworkStateAsync();
    return {
      online: state?.isConnected === true && state?.isInternetReachable !== false,
      connected: state?.isConnected === true,
      internetReachable: state?.isInternetReachable,
      type: String(state?.type || 'UNKNOWN').toLowerCase(),
    };
  } catch {
    return { online: null, connected: null, internetReachable: null, type: 'unknown' };
  }
}

export const normalizeRelayUrl = (value, fallback = DEFAULT_RELAY_URL) => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const match = raw.match(/^(https?|wss?):\/\/([^/?#]+)([^?#]*)?(?:\?([^#]*))?/i);
  if (!match) return fallback;
  const protocolMap = {
    http: 'ws',
    https: 'wss',
    ws: 'ws',
    wss: 'wss',
  };
  const protocol = protocolMap[match[1].toLowerCase()];
  const host = String(match[2] || '').trim();
  const path = String(match[3] || '').trim() || '/ws';
  const query = String(match[4] || '').trim();
  if (!protocol || !host || /[\s]/.test(host)) return fallback;
  const normalized = `${protocol}://${host}${path.startsWith('/') ? path : `/${path}`}${query ? `?${query}` : ''}`;
  return LEGACY_DEFAULT_RELAY_URLS.has(normalized) ? DEFAULT_RELAY_URL : normalized;
};

export const normalizeCloudSettings = (settings = {}) => ({
  relayUrl: normalizeRelayUrl(settings.relayUrl, DEFAULT_RELAY_URL),
  autoConnect: settings.autoConnect === true,
  reconnectEnabled: settings.reconnectEnabled !== false,
  heartbeatEnabled: settings.heartbeatEnabled !== false,
  connectionTimeoutMs: clampNumber(
    settings.connectionTimeoutMs,
    1000,
    60000,
    DEFAULT_TIMEOUT_MS,
  ),
  heartbeatIntervalMs: clampNumber(
    settings.heartbeatIntervalMs,
    5000,
    120000,
    DEFAULT_HEARTBEAT_MS,
  ),
  retryQueueMaxItems: clampNumber(
    settings.retryQueueMaxItems,
    1,
    500,
    DEFAULT_RETRY_QUEUE_SIZE,
  ),
});

class RelayClient {
  socket = null;
  status = 'disconnected';
  settings = normalizeCloudSettings();
  manuallyDisconnected = true;
  reconnectAttempts = 0;
  reconnectTimer = null;
  connectTimeout = null;
  heartbeatTimer = null;
  connectAttemptId = 0;
  pendingHeartbeatAt = 0;
  latencyMs = null;
  retryQueue = [];
  pendingPairing = null;
  connectedAt = null;
  lastConnectedAt = null;
  lastDisconnectedAt = null;
  activeRelayUrl = '';
  clientId = '';
  serverVersion = '';
  device = null;
  owner = null;
  presence = [];
  notifications = [];
  auth = null;
  secureChannel = new SecurePacketChannel();
  reliability = {
    state: 'offline',
    reconnectCount: 0,
    droppedConnections: 0,
    sessionRestoreCount: 0,
    retryCount: 0,
    lastRecoveryAt: null,
    lastRecoveryReason: null,
  };
  deviceIdentity = {
    deviceId: '',
    ownerId: '',
    pairedWithDeviceId: '',
    deviceName: 'OpenX Mobile',
    deviceType: 'phone',
    platform: 'mobile',
    softwareVersion: MOBILE_APP_VERSION,
  };
  friendlyMessage = 'Cloud relay is disconnected.';
  statusListeners = new Set();
  relayListeners = new Set();
  presenceListeners = new Set();
  notificationListeners = new Set();
  networkStatus = { online: null, connected: null, internetReachable: null, type: 'unknown' };
  networkSubscription = null;

  updateSettings(settings = {}) {
    this.settings = normalizeCloudSettings({ ...this.settings, ...settings });
    this.emitStatus();
    return this.getStatus();
  }

  async connect(settings = {}) {
    this.updateSettings(settings);
    this.manuallyDisconnected = false;
    this.clearReconnectTimer();
    this.ensureNetworkMonitoring();

    if (
      this.status === 'connected' &&
      this.socket?.readyState === WebSocket.OPEN
    ) {
      return this.getStatus();
    }
    await this.requireInternetConnection();
    return this.open(false);
  }

  async requireInternetConnection() {
    this.networkStatus = await readNetworkStatus();
    if (this.networkStatus.online !== false) return this.networkStatus;
    const error = Object.assign(new Error(OFFLINE_MESSAGE), { code: 'NETWORK_OFFLINE' });
    this.friendlyMessage = error.message;
    this.setStatus('error');
    throw error;
  }

  ensureNetworkMonitoring() {
    if (this.networkSubscription) return;
    this.networkSubscription = Network.addNetworkStateListener?.((state) => {
      const wasOffline = this.networkStatus.online === false;
      this.networkStatus = {
        online: state?.isConnected === true && state?.isInternetReachable !== false,
        connected: state?.isConnected === true,
        internetReachable: state?.isInternetReachable,
        type: String(state?.type || 'UNKNOWN').toLowerCase(),
      };
      if (this.networkStatus.online === false) {
        this.clearReconnectTimer();
        this.friendlyMessage = OFFLINE_MESSAGE;
        if (!this.manuallyDisconnected) this.setStatus('error');
        return;
      }
      if (wasOffline && !this.manuallyDisconnected && !this.isConnected()) {
        this.friendlyMessage = 'Internet connection restored. Reconnecting to OpenX...';
        this.scheduleReconnect();
      }
      this.emitStatus();
    }) || null;
  }

  open(isReconnect) {
    const attemptId = ++this.connectAttemptId;
    this.clearConnectTimeout();
    this.stopHeartbeat();
    this.closeCurrentSocket();
    this.setStatus(isReconnect ? 'reconnecting' : 'connecting');
    this.friendlyMessage = isReconnect
      ? 'Connection dropped. Reconnecting safely...'
      : 'Connecting to the relay server...';
    const socketRelayUrl = this.settings.relayUrl;

    return new Promise((resolve, reject) => {
      let settled = false;
      let socket;
      let failureReason = '';

      const settleSuccess = () => {
        if (settled) return;
        settled = true;
        resolve(this.getStatus());
      };

      const settleFailure = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      try {
        socket = new WebSocket(socketRelayUrl);
      } catch {
        const error = new Error('Unable to connect to the relay server.');
        this.setStatus('error');
        this.friendlyMessage = error.message;
        this.scheduleReconnect();
        settleFailure(error);
        return;
      }

      this.socket = socket;

      this.connectTimeout = setTimeout(async () => {
        if (attemptId !== this.connectAttemptId || socket !== this.socket || socket.readyState === WebSocket.OPEN) return;
        failureReason = 'connection-timeout';
        this.networkStatus = await readNetworkStatus();
        this.friendlyMessage = this.networkStatus.online === false
          ? OFFLINE_MESSAGE
          : 'The internet is available, but the relay server did not respond. Try again shortly.';
        this.setStatus('error');
        try {
          socket.close();
        } catch {}
        settleFailure(new Error(this.friendlyMessage));
      }, this.settings.connectionTimeoutMs);

      socket.onopen = () => {
        if (attemptId !== this.connectAttemptId || socket !== this.socket) return;
        this.clearConnectTimeout();
        this.connectedAt = Date.now();
        this.lastConnectedAt = this.connectedAt;
        this.activeRelayUrl = socketRelayUrl;
        this.reconnectAttempts = 0;
        this.friendlyMessage = 'Connected to the relay server.';
        this.setStatus('connected');
        this.registerDevice();
        this.startHeartbeat();
        settleSuccess();
      };

      socket.onmessage = (event) => {
        if (attemptId !== this.connectAttemptId || socket !== this.socket) return;
        this.handleMessage(event.data);
      };

      socket.onerror = async () => {
        if (attemptId !== this.connectAttemptId || socket !== this.socket) return;
        if (failureReason !== 'connection-timeout') failureReason = 'socket-error';
        this.clearConnectTimeout();
        this.networkStatus = await readNetworkStatus();
        this.friendlyMessage = this.networkStatus.online === false
          ? OFFLINE_MESSAGE
          : 'The internet is available, but the relay server is unavailable. Try again shortly.';
        this.setStatus('error');
        try {
          socket.close();
        } catch {}
        settleFailure(new Error(this.friendlyMessage));
      };

      socket.onclose = () => {
        if (attemptId !== this.connectAttemptId || socket !== this.socket) return;
        this.clearConnectTimeout();
        this.stopHeartbeat();
        this.socket = null;
        this.connectedAt = null;
        this.lastDisconnectedAt = Date.now();
        this.clientId = '';
        this.serverVersion = '';
        this.activeRelayUrl = '';
        this.device = null;
        this.owner = null;
        this.presence = [];
        this.notifications = [];
        this.auth = null;
        this.rejectPendingPairing(new Error('Cloud connection closed.'));
        if (this.manuallyDisconnected || this.status === 'disconnecting') {
          this.friendlyMessage = 'Cloud relay is disconnected.';
          this.setStatus('disconnected');
          settleSuccess();
          return;
        }
        this.friendlyMessage = 'Connection dropped. Reconnecting safely...';
        this.reliability.droppedConnections += 1;
        this.reliability.lastRecoveryAt = Date.now();
        this.reliability.lastRecoveryReason = failureReason || 'socket-closed';
        this.setStatus(this.settings.reconnectEnabled ? 'reconnecting' : 'error');
        this.scheduleReconnect();
        settleFailure(new Error(this.friendlyMessage));
      };
    });
  }

  disconnect(reason = 'manual-disconnect') {
    this.manuallyDisconnected = true;
    this.clearReconnectTimer();
    this.clearConnectTimeout();
    this.stopHeartbeat();
    this.friendlyMessage = 'Cloud relay is disconnected.';
    this.rejectPendingPairing(new Error('Cloud connection disconnected.'));

    if (!this.socket) {
      this.setStatus('disconnected');
      return Promise.resolve(this.getStatus({ reason }));
    }

    this.setStatus('disconnecting');
    this.closeCurrentSocket();
    this.connectedAt = null;
    this.lastDisconnectedAt = Date.now();
    this.clientId = '';
    this.serverVersion = '';
    this.activeRelayUrl = '';
    this.device = null;
    this.owner = null;
    this.presence = [];
    this.notifications = [];
    this.auth = null;
    this.setStatus('disconnected');
    return Promise.resolve(this.getStatus({ reason }));
  }

  async reconnect() {
    if (!this.settings.relayUrl) {
      this.setStatus('disconnected');
      throw new Error('Relay server is not configured.');
    }
    this.manuallyDisconnected = false;
    await this.requireInternetConnection();
    return this.open(true);
  }

  destroy() {
    this.statusListeners.clear();
    this.presenceListeners.clear();
    this.notificationListeners.clear();
    this.networkSubscription?.remove?.();
    this.networkSubscription = null;
    return this.disconnect('destroy');
  }

  isConnected() {
    return this.status === 'connected' && this.socket?.readyState === WebSocket.OPEN;
  }

  getLatency() {
    return Number.isFinite(this.latencyMs) ? this.latencyMs : null;
  }

  getStatus(extra = {}) {
    return {
      state: this.status,
      connected: this.isConnected(),
      relayUrl: this.settings.relayUrl,
      activeRelayUrl: this.activeRelayUrl,
      reconnectAttempts: this.reconnectAttempts,
      connectedAt: this.connectedAt,
      lastConnectedAt: this.lastConnectedAt,
      lastDisconnectedAt: this.lastDisconnectedAt,
      connectionDurationMs: this.connectedAt
        ? Math.max(0, Date.now() - this.connectedAt)
        : 0,
      pingMs: this.getLatency(),
      quality: this.isConnected() ? 'Connected' : 'Unavailable',
      clientId: this.clientId,
      serverVersion: this.serverVersion,
      device: this.device,
      owner: this.owner,
      presence: [...this.presence],
      notifications: [...this.notifications],
      reliability: this.getReliabilityStatus(),
      network: { ...this.networkStatus },
      authenticated: Boolean(this.auth?.accessToken),
      security: this.secureChannel.getStatus(),
      friendlyMessage: this.friendlyMessage,
      settings: { ...this.settings },
      ...extra,
    };
  }

  send(payload) {
    if (!this.isConnected()) return false;
    try {
      this.socket.send(JSON.stringify(this.withAuth(payload || {})));
      return true;
    } catch {
      this.setStatus('error');
      try {
        this.socket?.close?.();
      } catch {}
      return false;
    }
  }

  sendRelayPacket(packet) {
    const protectedPacket = this.protectRelayPacket(packet);
    const sent = this.send({
      type: 'relay:packet',
      packet: protectedPacket,
    });
    if (!sent && packet?.metadata?.retryable === true) {
      const queued = this.queueRetryableRelayPacket(packet);
      this.emitStatus();
      return queued;
    }
    return sent;
  }

  queueRetryableRelayPacket(packet) {
    if (!packet || typeof packet !== 'object') return false;
    const packetId = String(packet.packetId || packet.requestId || '').trim();
    if (packetId && this.retryQueue.some((item) => item.packetId === packetId)) return false;
    this.retryQueue.push({
      packetId,
      queuedAt: Date.now(),
      packet,
    });
    const maxItems = this.settings.retryQueueMaxItems || DEFAULT_RETRY_QUEUE_SIZE;
    if (this.retryQueue.length > maxItems) {
      this.retryQueue.splice(0, this.retryQueue.length - maxItems);
    }
    this.reliability.retryCount += 1;
    this.reliability.state = 'recovering';
    return true;
  }

  flushRetryQueue() {
    if (!this.isConnected() || this.retryQueue.length === 0) return 0;
    const queued = this.retryQueue.splice(0);
    let sentCount = 0;
    for (const item of queued) {
      const sent = this.send({
        type: 'relay:packet',
        packet: this.protectRelayPacket(item.packet),
      });
      if (sent) {
        sentCount += 1;
      } else {
        this.retryQueue.unshift(item);
        break;
      }
    }
    if (sentCount > 0) {
      this.reliability.state = 'healthy';
      this.emitStatus();
    }
    return sentCount;
  }

  updatePresence(state, metadata = {}) {
    return this.send({
      type: 'presence:update',
      requestId: `mobile-presence-${Date.now()}`,
      state,
      metadata,
      activity: true,
    });
  }

  subscribePresence() {
    return this.send({
      type: 'presence:subscribe',
      requestId: `mobile-presence-subscribe-${Date.now()}`,
    });
  }

  requestPresenceList() {
    return this.send({
      type: 'presence:list',
      requestId: `mobile-presence-list-${Date.now()}`,
    });
  }

  createNotification(payload = {}) {
    const protectedPayload = this.protectNotificationPayload(payload);
    return this.send({
      ...protectedPayload,
      type: 'notification:create',
      requestId: payload.requestId || createRequestId('mobile-notification-create'),
    });
  }

  protectNotificationPayload(payload = {}) {
    if (!this.secureChannel.hasKey()) return payload;
    const notificationId = String(payload.notificationId || '').trim();
    const destinationDeviceId = String(payload.destinationDeviceId || '').trim();
    const sourceDeviceId = String(this.device?.deviceId || this.deviceIdentity.deviceId || '').trim();
    const ownerId = String(this.device?.ownerId || this.owner?.id || this.deviceIdentity.ownerId || '').trim();
    if (!notificationId || !destinationDeviceId || !sourceDeviceId || !ownerId) return payload;
    try {
      const details = payload.details && typeof payload.details === 'object' ? payload.details : {};
      const content = {
        appName: details.appName || payload.appName || '',
        packageName: details.packageName || payload.packageName || '',
        title: payload.title || '',
        message: payload.message || '',
        details,
        category: payload.category || 'phone',
        priority: payload.priority || 'normal',
        timestamp: details.timestamp || payload.timestamp || Date.now(),
        repeatCount: details.repeatCount || payload.repeatCount || 1,
      };
      const envelope = encryptJson(this.secureChannel.masterKey, content, {
        domain: 'phone-notification',
        context: { ownerId, sourceDeviceId, destinationDeviceId, notificationId },
        aad: { ownerId, sourceDeviceId, destinationDeviceId, notificationId },
      });
      return {
        ...payload,
        title: 'Encrypted phone notification',
        message: 'OpenX protected this notification.',
        details: {
          encrypted: true,
          source: 'openx-mobile',
          deviceName: details.deviceName || this.deviceIdentity.deviceName || 'OpenX Mobile',
          timestamp: content.timestamp,
          repeatCount: content.repeatCount,
        },
        encryptedContent: {
          encrypted: true,
          scheme: envelope.scheme,
          envelope,
        },
      };
    } catch {
      return payload;
    }
  }

  requestNotificationList() {
    return this.send({
      type: 'notification:list',
      requestId: createRequestId('mobile-notification-list'),
    });
  }

  markNotificationRead(notificationId) {
    return this.send({
      type: 'notification:read',
      requestId: createRequestId('mobile-notification-read'),
      notificationId,
    });
  }

  dismissNotification(notificationId) {
    return this.send({
      type: 'notification:dismiss',
      requestId: createRequestId('mobile-notification-dismiss'),
      notificationId,
    });
  }

  clearNotifications() {
    return this.send({
      type: 'notification:clear',
      requestId: createRequestId('mobile-notification-clear'),
    });
  }

  setDeviceIdentity(identity = {}) {
    this.deviceIdentity = {
      ...this.deviceIdentity,
      deviceId: String(identity.deviceId || this.deviceIdentity.deviceId || '').trim(),
      ownerId: String(identity.ownerId || this.deviceIdentity.ownerId || '').trim(),
      pairedWithDeviceId: String(identity.pairedWithDeviceId || this.deviceIdentity.pairedWithDeviceId || '').trim(),
      deviceName: String(identity.deviceName || this.deviceIdentity.deviceName || 'OpenX Mobile').trim(),
      deviceType: String(identity.deviceType || this.deviceIdentity.deviceType || 'phone').trim(),
      platform: String(identity.platform || this.deviceIdentity.platform || 'mobile').trim(),
      softwareVersion: String(identity.softwareVersion || identity.version || this.deviceIdentity.softwareVersion || MOBILE_APP_VERSION).trim(),
    };
    if (this.isConnected()) this.registerDevice();
  }

  registerDevice() {
    if (!this.deviceIdentity.deviceId) return false;
    return this.send({
      type: 'device:register',
      requestId: `mobile-device-${Date.now()}`,
      deviceId: this.deviceIdentity.deviceId,
      ownerId: this.deviceIdentity.ownerId || undefined,
      deviceType: this.deviceIdentity.deviceType,
      friendlyName: this.deviceIdentity.deviceName,
      platform: this.deviceIdentity.platform,
      softwareVersion: this.deviceIdentity.softwareVersion,
      version: this.deviceIdentity.softwareVersion,
      capabilities: {
        cloudPairing: true,
        localFirst: true,
        pairedWithDeviceId: this.deviceIdentity.pairedWithDeviceId || '',
      },
    });
  }

  pairWithToken({ relayUrl, pairToken, security = null, deviceName, deviceType = 'phone', timeoutMs = DEFAULT_PAIR_TIMEOUT_MS } = {}) {
    const token = String(pairToken || '').trim();
    if (!token) {
      return Promise.reject(new Error('Invalid cloud pairing QR code.'));
    }
    if (!this.deviceIdentity.deviceId) {
      return Promise.reject(new Error('Mobile device identity is not ready. Try scanning again.'));
    }
    const requestId = `cloud-mobile-pair-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const startPairRequest = () => new Promise((resolve, reject) => {
      this.rejectPendingPairing(new Error('A new cloud pairing attempt was started.'));
      const timer = setTimeout(() => {
        this.rejectPendingPairing(new Error('Cloud pairing request timed out.'));
      }, Math.max(30000, Math.min(900000, Number(timeoutMs) || DEFAULT_PAIR_TIMEOUT_MS)));
      this.pendingPairing = {
        requestId,
        resolve,
        reject,
        timer,
        pairingSecurity: security && typeof security === 'object' ? security : null,
      };
      const sent = this.send({
        type: 'cloud-pair:request',
        requestId,
        token,
        deviceId: this.deviceIdentity.deviceId,
        deviceName: String(deviceName || 'OpenX Mobile').trim() || 'OpenX Mobile',
        deviceType,
        platform: this.deviceIdentity.platform,
        softwareVersion: this.deviceIdentity.softwareVersion,
        version: this.deviceIdentity.softwareVersion,
        capabilities: {
          cloudPairing: true,
          localFirst: true,
        },
      });
      if (!sent) {
        this.rejectPendingPairing(new Error('Cloud relay is not connected.'));
      }
    });

    const targetRelayUrl = relayUrl ? normalizeRelayUrl(relayUrl, this.settings.relayUrl) : '';
    const nextSettings = targetRelayUrl ? { relayUrl: targetRelayUrl } : {};
    if (this.isConnected()) {
      const currentRelayUrl = normalizeRelayUrl(this.activeRelayUrl || this.settings.relayUrl);
      if (targetRelayUrl && currentRelayUrl !== targetRelayUrl) {
        return this.disconnect('pairing-relay-switch')
          .then(() => this.connect(nextSettings))
          .then(startPairRequest);
      }
      return startPairRequest();
    }
    return this.connect(nextSettings).then(startPairRequest);
  }

  authenticate() {
    if (this.auth?.accessToken) return Promise.resolve({ authenticated: true });
    return Promise.resolve({ authenticated: false, reason: 'not-connected' });
  }

  setAuthProvider() {
    return false;
  }

  subscribeToStatus(listener) {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  subscribeToRelayPackets(listener) {
    this.relayListeners.add(listener);
    return () => this.relayListeners.delete(listener);
  }

  subscribeToPresence(listener) {
    this.presenceListeners.add(listener);
    listener([...this.presence]);
    return () => this.presenceListeners.delete(listener);
  }

  subscribeToNotifications(listener) {
    this.notificationListeners.add(listener);
    listener([...this.notifications]);
    return () => this.notificationListeners.delete(listener);
  }

  handleMessage(rawMessage) {
    try {
      const message = JSON.parse(rawMessage);
      if (message.type === 'pong' || /:ack$/.test(String(message.type || ''))) {
        this.handleHeartbeatAck();
        if (message.type === 'pong' || message.type === 'mobile-heartbeat:ack') return;
      }
      if (message.type === 'connected') {
        this.clientId = String(message.clientId || '').trim();
        this.serverVersion = String(message.version || '').trim();
        this.emitStatus();
        return;
      }
      if (message.type === 'device:registered') {
        this.device = message.device || null;
        this.owner = message.owner || null;
        this.auth = message.auth || this.auth;
        this.reliability.state = 'healthy';
        this.reliability.sessionRestoreCount += 1;
        this.subscribePresence();
        this.requestNotificationList();
        this.flushRetryQueue();
        this.emitStatus();
        return;
      }
      if (message.type === 'cloud-pair:waiting') {
        this.friendlyMessage = message.message || 'Waiting for desktop approval.';
        this.emitStatus();
        return;
      }
      if (message.type === 'cloud-pair:paired') {
        const securePairing = this.resolvePairingSecurity(message);
        if (this.pendingPairing?.pairingSecurity?.required === true && !securePairing?.masterKey) {
          this.rejectPendingPairing(new Error('Secure pairing key exchange failed.'));
          return;
        }
        this.auth = message.auth || this.auth;
        if (securePairing?.masterKey) this.setE2EEMasterKey(securePairing.masterKey);
        this.resolvePendingPairing({
          paired: true,
          message: message.message || 'Paired Successfully',
          pairRequestId: message.pairRequestId || '',
          tokenId: message.tokenId || '',
          ownerId: message.ownerId || '',
          desktopDeviceId: message.desktopDeviceId || '',
          phoneDeviceId: message.phoneDeviceId || '',
          pair: message.pair || null,
          devices: message.devices || [],
          device: message.device || null,
          security: securePairing,
        });
        return;
      }
      if (message.type === 'cloud-pair:rejected') {
        this.rejectPendingPairing(new Error(message.message || 'Pairing rejected by desktop.'));
        return;
      }
      if (message.type === 'cloud-pair:error') {
        this.rejectPendingPairing(new Error(message.message || 'Cloud pairing failed.'));
        return;
      }
      if (
        message.type === 'relay:packet' ||
        message.type === 'relay:ack' ||
        message.type === 'relay:error'
      ) {
        if (message.type === 'relay:ack') this.reliability.state = 'healthy';
        if (message.type === 'relay:packet') {
          const decrypted = this.unprotectRelayMessage(message);
          if (decrypted) this.emitRelayMessage(decrypted);
        } else {
          this.emitRelayMessage(message);
        }
        return;
      }
      if (message.type === 'auth:refreshed') {
        this.auth = message.auth || this.auth;
        this.emitStatus();
        return;
      }
      if (message.type === 'auth:error') {
        if (message.code === 'expired-token') this.refreshAuth();
        return;
      }
      if (message.type === 'presence:update') {
        this.upsertPresence(message.presence);
        this.emitPresence();
        this.emitStatus();
        return;
      }
      if (message.type === 'presence:list' || message.type === 'presence:subscribed') {
        this.presence = Array.isArray(message.presence) ? message.presence : [];
        this.emitPresence();
        this.emitStatus();
        return;
      }
      if (message.type === 'notification:new') {
        this.upsertNotification(message.notification);
        this.emitNotifications();
        this.emitStatus();
        return;
      }
      if (message.type === 'notification:list') {
        this.notifications = Array.isArray(message.notifications) ? message.notifications : [];
        this.emitNotifications();
        this.emitStatus();
        return;
      }
      if (
        message.type === 'notification:read' ||
        message.type === 'notification:dismiss' ||
        message.type === 'notification:queued'
      ) {
        if (message.notification) this.upsertNotification(message.notification);
        this.emitNotifications();
        this.emitStatus();
        return;
      }
      if (message.type === 'notification:deleted') {
        this.notifications = this.notifications.filter(
          (item) => item.notificationId !== message.notificationId,
        );
        this.emitNotifications();
        this.emitStatus();
        return;
      }
      if (message.type === 'notification:cleared') {
        this.notifications = [];
        this.emitNotifications();
        this.emitStatus();
        return;
      }
    } catch {
      // Ignore malformed relay payloads safely; connection health is handled separately.
    }
  }

  emitRelayMessage(message) {
    this.relayListeners.forEach((listener) => {
      try {
        listener(message);
      } catch {}
    });
  }

  setE2EEMasterKey(masterKey) {
    const applied = this.secureChannel.setMasterKey(masterKey);
    this.emitStatus();
    return applied;
  }

  protectRelayPacket(packet) {
    try {
      return this.secureChannel.encryptPacket(packet);
    } catch {
      return packet;
    }
  }

  unprotectRelayMessage(message) {
    try {
      const packet = this.secureChannel.decryptPacket(message.packet || {});
      return { ...message, packet };
    } catch {
      return {
        type: 'relay:error',
        code: 'e2ee-packet-rejected',
        packetId: message?.packet?.packetId || null,
        requestId: message?.packet?.requestId || null,
        message: 'Encrypted packet could not be authenticated.',
      };
    }
  }

  resolvePairingSecurity(message = {}) {
    const pending = this.pendingPairing;
    const pairingSecret = String(pending?.pairingSecurity?.pairingSecret || '').trim();
    const encryptedMasterKey = message.security?.encryptedMasterKey;
    if (!pairingSecret || !encryptedMasterKey) return null;
    try {
      const decrypted = decryptJson(pairingSecret, encryptedMasterKey, {
        domain: 'pairing-master-key',
        context: {
          pairRequestId: message.pairRequestId || '',
          tokenId: message.tokenId || '',
        },
        aad: {
          pairRequestId: message.pairRequestId || '',
          tokenId: message.tokenId || '',
        },
      });
      return {
        scheme: 'openx-e2ee-v1',
        enabled: true,
        masterKey: String(decrypted?.masterKey || '').trim(),
        createdAt: decrypted?.createdAt || Date.now(),
      };
    } catch {
      return null;
    }
  }

  upsertPresence(presence) {
    if (!presence?.deviceId) return false;
    const index = this.presence.findIndex((item) => item.deviceId === presence.deviceId);
    if (index >= 0) this.presence[index] = { ...this.presence[index], ...presence };
    else this.presence.push(presence);
    return true;
  }

  upsertNotification(notification) {
    if (!notification?.notificationId) return false;
    const index = this.notifications.findIndex((item) => item.notificationId === notification.notificationId);
    if (index >= 0) this.notifications[index] = { ...this.notifications[index], ...notification };
    else this.notifications.unshift(notification);
    const weights = { low: 0, normal: 1, high: 2, critical: 3 };
    this.notifications.sort((left, right) => (
      (weights[right.priority] || 0) - (weights[left.priority] || 0) ||
      Number(right.createdAt || 0) - Number(left.createdAt || 0)
    ));
    this.notifications = this.notifications.slice(0, 100);
    return true;
  }

  emitPresence() {
    const presence = [...this.presence];
    this.presenceListeners.forEach((listener) => {
      try {
        listener(presence);
      } catch {}
    });
  }

  emitNotifications() {
    const notifications = [...this.notifications];
    this.notificationListeners.forEach((listener) => {
      try {
        listener(notifications);
      } catch {}
    });
  }

  resolvePendingPairing(result) {
    const pending = this.pendingPairing;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingPairing = null;
    pending.resolve(result);
  }

  rejectPendingPairing(error) {
    const pending = this.pendingPairing;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingPairing = null;
    pending.reject(error);
  }

  setStatus(status) {
    if (!CONNECTION_STATES.has(status)) return;
    this.status = status;
    this.emitStatus();
  }

  emitStatus() {
    const status = this.getStatus();
    this.statusListeners.forEach((listener) => listener(status));
  }

  handleHeartbeatAck() {
    if (this.pendingHeartbeatAt > 0) {
      this.latencyMs = Math.max(0, Date.now() - this.pendingHeartbeatAt);
      this.pendingHeartbeatAt = 0;
    }
    if (this.reliability.state !== 'healthy' && this.isConnected()) {
      this.reliability.state = 'healthy';
    }
  }

  scheduleReconnect() {
    if (
      this.manuallyDisconnected ||
      this.reconnectTimer ||
      this.settings.reconnectEnabled === false
    ) {
      return;
    }
    this.reconnectAttempts += 1;
    const baseDelay = RECONNECT_DELAYS_MS[
      Math.min(this.reconnectAttempts - 1, RECONNECT_DELAYS_MS.length - 1)
    ];
    const delay = withReconnectJitter(baseDelay);
    this.reliability.state = 'reconnecting';
    this.reliability.reconnectCount += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnect().catch(() => {
        // onclose/onerror drives the next reconnect decision.
      });
    }, delay);
    this.emitStatus();
  }

  startHeartbeat() {
    this.stopHeartbeat();
    if (!this.settings.heartbeatEnabled) return;
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected()) return;
      if (
        this.pendingHeartbeatAt > 0 &&
        Date.now() - this.pendingHeartbeatAt > this.settings.heartbeatIntervalMs * 2
      ) {
        this.friendlyMessage = 'Cloud heartbeat timed out. Reconnecting to OpenX...';
        this.reliability.lastRecoveryAt = Date.now();
        this.reliability.lastRecoveryReason = 'heartbeat-timeout';
        try {
          this.socket?.close?.();
        } catch {}
        return;
      }
      this.pendingHeartbeatAt = Date.now();
      this.send({
        type: 'mobile-heartbeat',
        requestId: createRequestId('mobile-heartbeat'),
        timestamp: this.pendingHeartbeatAt,
      });
    }, this.settings.heartbeatIntervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.pendingHeartbeatAt = 0;
  }

  closeCurrentSocket() {
    if (!this.socket) return;
    const socket = this.socket;
    this.socket = null;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      if (
        socket.readyState === WebSocket.CONNECTING ||
        socket.readyState === WebSocket.OPEN
      ) {
        socket.close();
      }
    } catch {}
  }

  clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  clearConnectTimeout() {
    if (!this.connectTimeout) return;
    clearTimeout(this.connectTimeout);
    this.connectTimeout = null;
  }

  withAuth(payload) {
    const type = String(payload?.type || '');
    if (!this.auth?.accessToken || type === 'device:register' || type.startsWith('auth:')) {
      return payload;
    }
    return { ...payload, accessToken: this.auth.accessToken };
  }

  refreshAuth() {
    if (!this.auth?.refreshToken) return false;
    return this.send({
      type: 'auth:refresh',
      requestId: `mobile-auth-refresh-${Date.now()}`,
      refreshToken: this.auth.refreshToken,
    });
  }

  getReliabilityStatus() {
    return {
      ...this.reliability,
      reconnectAttempts: this.reconnectAttempts,
      retryQueueSize: this.retryQueue.length,
    };
  }
}

export const relayClient = new RelayClient();
