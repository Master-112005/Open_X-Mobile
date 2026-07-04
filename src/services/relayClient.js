const CONNECTION_STATES = new Set([
  'disconnected',
  'connecting',
  'connected',
  'reconnecting',
  'disconnecting',
  'error',
]);

const DEFAULT_RELAY_URL = 'ws://localhost:8080/ws';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_HEARTBEAT_MS = 30000;
const DEFAULT_PAIR_TIMEOUT_MS = 5 * 60 * 1000;
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 20000];

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
};

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
  return `${protocol}://${host}${path.startsWith('/') ? path : `/${path}`}${query ? `?${query}` : ''}`;
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
  pendingPairing = null;
  connectedAt = null;
  lastConnectedAt = null;
  lastDisconnectedAt = null;
  clientId = '';
  serverVersion = '';
  device = null;
  owner = null;
  presence = [];
  notifications = [];
  deviceIdentity = {
    deviceId: '',
    deviceName: 'OpenX Mobile',
    deviceType: 'phone',
    platform: 'mobile',
  };
  friendlyMessage = 'Cloud mode is disconnected. Local mode is active.';
  statusListeners = new Set();
  relayListeners = new Set();
  presenceListeners = new Set();
  notificationListeners = new Set();

  updateSettings(settings = {}) {
    this.settings = normalizeCloudSettings({ ...this.settings, ...settings });
    this.emitStatus();
    return this.getStatus();
  }

  connect(settings = {}) {
    this.updateSettings(settings);
    this.manuallyDisconnected = false;
    this.clearReconnectTimer();

    if (
      this.status === 'connected' &&
      this.socket?.readyState === WebSocket.OPEN
    ) {
      return Promise.resolve(this.getStatus());
    }

    return this.open(false);
  }

  open(isReconnect) {
    this.closeCurrentSocket();
    this.setStatus(isReconnect ? 'reconnecting' : 'connecting');
    this.friendlyMessage = isReconnect
      ? 'Connection dropped. Reconnecting safely...'
      : 'Connecting to the relay server...';

    return new Promise((resolve, reject) => {
      let settled = false;
      let socket;

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
        socket = new WebSocket(this.settings.relayUrl);
      } catch {
        const error = new Error('Unable to connect to the relay server.');
        this.setStatus('error');
        this.friendlyMessage = error.message;
        this.scheduleReconnect();
        settleFailure(error);
        return;
      }

      this.socket = socket;

      this.connectTimeout = setTimeout(() => {
        if (socket !== this.socket || socket.readyState === WebSocket.OPEN) return;
        this.friendlyMessage = 'Unable to connect to the relay server.';
        this.setStatus('error');
        try {
          socket.close();
        } catch {}
        settleFailure(new Error(this.friendlyMessage));
      }, this.settings.connectionTimeoutMs);

      socket.onopen = () => {
        if (socket !== this.socket) return;
        this.clearConnectTimeout();
        this.connectedAt = Date.now();
        this.lastConnectedAt = this.connectedAt;
        this.reconnectAttempts = 0;
        this.friendlyMessage = 'Connected to the relay server.';
        this.setStatus('connected');
        this.registerDevice();
        this.startHeartbeat();
        settleSuccess();
      };

      socket.onmessage = (event) => {
        if (socket !== this.socket) return;
        this.handleMessage(event.data);
      };

      socket.onerror = () => {
        if (socket !== this.socket) return;
        this.clearConnectTimeout();
        this.friendlyMessage = 'Relay server is unavailable.';
        this.setStatus('error');
        try {
          socket.close();
        } catch {}
        settleFailure(new Error(this.friendlyMessage));
      };

      socket.onclose = () => {
        if (socket !== this.socket) return;
        this.clearConnectTimeout();
        this.stopHeartbeat();
        this.socket = null;
        this.connectedAt = null;
        this.lastDisconnectedAt = Date.now();
        this.clientId = '';
        this.serverVersion = '';
        this.device = null;
        this.owner = null;
        this.presence = [];
        this.notifications = [];
        this.rejectPendingPairing(new Error('Cloud connection closed.'));
        if (this.manuallyDisconnected || this.status === 'disconnecting') {
          this.friendlyMessage = 'Cloud mode is disconnected. Local mode is active.';
          this.setStatus('disconnected');
          settleSuccess();
          return;
        }
        this.friendlyMessage = 'Connection dropped. Reconnecting safely...';
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
    this.friendlyMessage = 'Cloud mode is disconnected. Local mode is active.';
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
    this.device = null;
    this.owner = null;
    this.presence = [];
    this.notifications = [];
    this.setStatus('disconnected');
    return Promise.resolve(this.getStatus({ reason }));
  }

  reconnect() {
    if (!this.settings.relayUrl) {
      this.setStatus('disconnected');
      return Promise.reject(new Error('Relay server is not configured.'));
    }
    this.manuallyDisconnected = false;
    return this.open(true);
  }

  destroy() {
    this.statusListeners.clear();
    this.presenceListeners.clear();
    this.notificationListeners.clear();
    return this.disconnect('destroy');
  }

  isConnected() {
    return this.status === 'connected' && this.socket?.readyState === WebSocket.OPEN;
  }

  getLatency() {
    return null;
  }

  getStatus(extra = {}) {
    return {
      state: this.status,
      connected: this.isConnected(),
      relayUrl: this.settings.relayUrl,
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
      friendlyMessage: this.friendlyMessage,
      settings: { ...this.settings },
      ...extra,
    };
  }

  send(payload) {
    if (!this.isConnected()) return false;
    try {
      this.socket.send(JSON.stringify(payload || {}));
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
    return this.send({
      type: 'relay:packet',
      packet,
    });
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
    return this.send({
      ...payload,
      type: 'notification:create',
      requestId: payload.requestId || `mobile-notification-create-${Date.now()}`,
    });
  }

  requestNotificationList() {
    return this.send({
      type: 'notification:list',
      requestId: `mobile-notification-list-${Date.now()}`,
    });
  }

  markNotificationRead(notificationId) {
    return this.send({
      type: 'notification:read',
      requestId: `mobile-notification-read-${Date.now()}`,
      notificationId,
    });
  }

  dismissNotification(notificationId) {
    return this.send({
      type: 'notification:dismiss',
      requestId: `mobile-notification-dismiss-${Date.now()}`,
      notificationId,
    });
  }

  clearNotifications() {
    return this.send({
      type: 'notification:clear',
      requestId: `mobile-notification-clear-${Date.now()}`,
    });
  }

  setDeviceIdentity(identity = {}) {
    this.deviceIdentity = {
      ...this.deviceIdentity,
      deviceId: String(identity.deviceId || this.deviceIdentity.deviceId || '').trim(),
      deviceName: String(identity.deviceName || this.deviceIdentity.deviceName || 'OpenX Mobile').trim(),
      deviceType: String(identity.deviceType || this.deviceIdentity.deviceType || 'phone').trim(),
      platform: String(identity.platform || this.deviceIdentity.platform || 'mobile').trim(),
    };
    if (this.isConnected()) this.registerDevice();
  }

  registerDevice() {
    if (!this.deviceIdentity.deviceId) return false;
    return this.send({
      type: 'device:register',
      requestId: `mobile-device-${Date.now()}`,
      deviceId: this.deviceIdentity.deviceId,
      deviceType: this.deviceIdentity.deviceType,
      friendlyName: this.deviceIdentity.deviceName,
      platform: this.deviceIdentity.platform,
      capabilities: {
        cloudPairing: true,
        localFirst: true,
      },
    });
  }

  pairWithToken({ relayUrl, pairToken, deviceName, deviceType = 'mobile', timeoutMs = DEFAULT_PAIR_TIMEOUT_MS } = {}) {
    const token = String(pairToken || '').trim();
    if (!token) {
      return Promise.reject(new Error('Invalid cloud pairing QR code.'));
    }
    const requestId = `cloud-mobile-pair-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const startPairRequest = () => new Promise((resolve, reject) => {
      this.rejectPendingPairing(new Error('A new cloud pairing attempt was started.'));
      const timer = setTimeout(() => {
        this.rejectPendingPairing(new Error('Cloud pairing request timed out.'));
      }, Math.max(30000, Math.min(900000, Number(timeoutMs) || DEFAULT_PAIR_TIMEOUT_MS)));
      this.pendingPairing = { requestId, resolve, reject, timer };
      const sent = this.send({
        type: 'cloud-pair:request',
        requestId,
        token,
        deviceId: this.deviceIdentity.deviceId,
        deviceName: String(deviceName || 'OpenX Mobile').trim() || 'OpenX Mobile',
        deviceType,
        platform: this.deviceIdentity.platform,
        capabilities: {
          cloudPairing: true,
          localFirst: true,
        },
      });
      if (!sent) {
        this.rejectPendingPairing(new Error('Cloud relay is not connected.'));
      }
    });

    const nextSettings = relayUrl ? { relayUrl } : {};
    if (this.isConnected()) return startPairRequest();
    return this.connect(nextSettings).then(startPairRequest);
  }

  authenticate() {
    return Promise.resolve({ authenticated: false, reason: 'not-implemented' });
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
      if (message.type === 'connected') {
        this.clientId = String(message.clientId || '').trim();
        this.serverVersion = String(message.version || '').trim();
        this.emitStatus();
        return;
      }
      if (message.type === 'device:registered') {
        this.device = message.device || null;
        this.owner = message.owner || null;
        this.subscribePresence();
        this.requestNotificationList();
        this.emitStatus();
        return;
      }
      if (message.type === 'cloud-pair:waiting') {
        this.friendlyMessage = message.message || 'Waiting for desktop approval.';
        this.emitStatus();
        return;
      }
      if (message.type === 'cloud-pair:paired') {
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
        this.emitRelayMessage(message);
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

  scheduleReconnect() {
    if (
      this.manuallyDisconnected ||
      this.reconnectTimer ||
      this.settings.reconnectEnabled === false
    ) {
      return;
    }
    this.reconnectAttempts += 1;
    const delay = RECONNECT_DELAYS_MS[
      Math.min(this.reconnectAttempts - 1, RECONNECT_DELAYS_MS.length - 1)
    ];
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
      this.send({
        type: 'mobile-heartbeat',
        timestamp: Date.now(),
      });
    }, this.settings.heartbeatIntervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
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
}

export const relayClient = new RelayClient();
