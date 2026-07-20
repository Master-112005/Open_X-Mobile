import { AppState } from 'react-native';
import { ChatEvents } from './ChatEvents';

/**
 * Mobile Chat WebSocket connection manager with reconnect and heartbeat infrastructure.
 */
export class ChatConnectionManager {
  /**
   * Creates a Mobile Chat connection manager.
   * @param {object} options Connection dependencies.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.logger = options.logger;
    this.eventBus = options.eventBus;
    this.statusManager = options.statusManager;
    this.socket = null;
    this.state = 'offline';
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.connectionTimeout = null;
    this.lastConnectedAt = null;
    this.lastDisconnectedAt = null;
    this.lastPongAt = null;
    this.manualDisconnect = true;
    this.appStateSubscription = null;
  }

  /**
   * Connects to the future Chat Server.
   * @returns {Promise<object>} Connection status.
   */
  connect() {
    this.manualDisconnect = false;
    this.clearReconnectTimer();
    this.setState('connecting');
    this.ensureAppStateSubscription();
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (error, value) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(value);
      };
      try {
        this.socket = new WebSocket(this.config.serverUrl);
      } catch (error) {
        this.handleConnectionFailure(error);
        settle(error);
        return;
      }
      this.connectionTimeout = setTimeout(() => {
        const error = new Error('Mobile Chat connection timed out.');
        this.handleConnectionFailure(error);
        settle(error);
      }, this.config.connectionTimeoutMs);
      this.socket.onopen = () => {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
        this.lastConnectedAt = new Date().toISOString();
        this.reconnectAttempts = 0;
        this.setState('connected');
        this.startHeartbeat();
        this.sendInfrastructureEvent('connection:ready', { protocolVersion: this.config.protocolVersion });
        settle(null, this.getStatus());
      };
      this.socket.onmessage = (event) => this.handleMessage(event.data);
      this.socket.onclose = () => this.handleClose();
      this.socket.onerror = (event) => this.handleConnectionFailure(new Error(event?.message || 'Mobile Chat socket error.'));
    });
  }

  /**
   * Disconnects from the Chat Server.
   */
  disconnect() {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.clearConnectionTimeout();
    this.stopHeartbeat();
    this.removeAppStateSubscription();
    if (this.socket) this.socket.close(1000, 'mobile-chat-disconnect');
    this.socket = null;
    this.setState('disconnected');
  }

  /**
   * Sends an infrastructure-only event.
   * @param {string} type Event type.
   * @param {object} data Event data.
   * @returns {boolean} Whether the event was sent.
   */
  sendInfrastructureEvent(type, data = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    if (/^(chat|message|contact|account|otp|notification|encryption):/i.test(type)) {
      throw new Error('Future chat business events are disabled in Phase 1.');
    }
    this.socket.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
    return true;
  }

  /**
   * Sends a Phase 8 messaging event.
   * @param {string} type Event type.
   * @param {object} data Event data.
   * @returns {boolean} Whether the event was sent.
   */
  sendMessageEvent(type, data = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    if (!/^(message|typing):/i.test(type)) throw new Error('Only Phase 8 message events can use sendMessageEvent.');
    this.socket.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
    return true;
  }

  /**
   * Handles inbound server data.
   * @param {string} data Raw event data.
   */
  handleMessage(data) {
    try {
      const payload = JSON.parse(String(data || '{}'));
      if (payload.type === 'pong') {
        this.lastPongAt = new Date().toISOString();
        this.eventBus.emit(ChatEvents.CONNECTION_HEARTBEAT, { lastPongAt: this.lastPongAt });
        return;
      }
      if (payload.type === 'connection:ready:ack') this.setState('connected');
      if (payload.type === 'connection:identified') this.setState('ready');
      if (/^connection:/i.test(payload.type)) this.eventBus.emit(payload.type, payload.data || {});
      if (/^(message|typing):/i.test(payload.type)) this.eventBus.emit(payload.type, payload.data || {});
    } catch (error) {
      this.logger.warn('Mobile Chat ignored malformed server message', { error: error.message });
    }
  }

  /**
   * Handles socket close.
   */
  handleClose() {
    this.clearConnectionTimeout();
    this.stopHeartbeat();
    this.lastDisconnectedAt = new Date().toISOString();
    this.setState('disconnected');
    if (!this.manualDisconnect) this.scheduleReconnect();
  }

  /**
   * Handles connection failure.
   * @param {Error} error Failure error.
   */
  handleConnectionFailure(error) {
    this.clearConnectionTimeout();
    this.logger.warn('Mobile Chat connection error', { error: error.message });
    this.eventBus.emit(ChatEvents.CONNECTION_ERROR, { error: error.message });
    this.setState('offline', { error: error.message });
    if (!this.manualDisconnect) this.scheduleReconnect();
  }

  /**
   * Schedules reconnect using bounded exponential backoff.
   */
  scheduleReconnect() {
    if (this.reconnectTimer || this.reconnectAttempts >= this.config.maxReconnectAttempts) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(
      this.config.reconnectMaxDelayMs,
      this.config.reconnectMinDelayMs * (2 ** Math.max(0, this.reconnectAttempts - 1)),
    );
    this.setState('reconnecting');
    this.eventBus.emit(ChatEvents.CONNECTION_RECONNECTING, { reconnectAttempts: this.reconnectAttempts, delay });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, delay);
  }

  /**
   * Starts heartbeat pings.
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.sendInfrastructureEvent('ping', { client: 'mobile' })) this.handleClose();
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Stops heartbeat pings.
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  /**
   * Clears reconnect timer.
   */
  clearReconnectTimer() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  /**
   * Clears a pending socket connection timeout.
   */
  clearConnectionTimeout() {
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
    this.connectionTimeout = null;
  }

  /**
   * Subscribes to foreground/background state for future background-ready behavior.
   */
  ensureAppStateSubscription() {
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !this.manualDisconnect && this.state !== 'connected') {
        this.scheduleReconnect();
      }
    });
  }

  /**
   * Removes app state subscription.
   */
  removeAppStateSubscription() {
    this.appStateSubscription?.remove?.();
    this.appStateSubscription = null;
  }

  /**
   * Updates connection state.
   * @param {string} state New state.
   * @param {object} details State details.
   */
  setState(state, details = {}) {
    this.state = state;
    this.statusManager.setState(state, details);
    const eventMap = {
      connecting: ChatEvents.CONNECTION_CONNECTING,
      connected: ChatEvents.CONNECTION_CONNECTED,
      ready: ChatEvents.CONNECTION_READY,
      disconnected: ChatEvents.CONNECTION_DISCONNECTED,
      offline: ChatEvents.CONNECTION_DISCONNECTED,
      reconnecting: ChatEvents.CONNECTION_RECONNECTING,
    };
    if (eventMap[state]) this.eventBus.emit(eventMap[state], { state, ...details });
  }

  /**
   * Returns connection status.
   * @returns {object} Connection snapshot.
   */
  getStatus() {
    return Object.freeze({
      state: this.state,
      reconnectAttempts: this.reconnectAttempts,
      lastConnectedAt: this.lastConnectedAt,
      lastDisconnectedAt: this.lastDisconnectedAt,
      lastPongAt: this.lastPongAt,
      serverUrl: this.config.serverUrl,
      backgroundReady: this.config.backgroundReady,
    });
  }
}

export default ChatConnectionManager;
