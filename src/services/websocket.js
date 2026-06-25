const RECONNECT_DELAY_MS = 5000;
const CONNECT_TIMEOUT_MS = 8000;
const WAITING_FOR_DESKTOP_MESSAGE = 'Waiting for OpenX Desktop...';

const CONNECTION_STATES = new Set([
  'connecting',
  'connected',
  'disconnected',
  'reconnecting',
  'error',
]);

const normalizeHost = (host) =>
  host
    .trim()
    .replace(/^wss?:\/\//i, '')
    .split('/')[0]
    .replace(/:\d+$/, '');

class OpenXWebSocketService {
  socket = null;
  host = '';
  port = '';
  status = 'disconnected';
  reconnectTimer = null;
  connectTimeout = null;
  manuallyDisconnected = true;
  statusListeners = new Set();
  messageListeners = new Set();

  connect(host, port) {
    return this.open(host, port, false);
  }

  open(host, port, isReconnect) {
    const nextHost = normalizeHost(host ?? '');
    const nextPort = String(port ?? '').trim();

    if (
      !nextHost ||
      !/^\d+$/.test(nextPort) ||
      Number(nextPort) < 1 ||
      Number(nextPort) > 65535
    ) {
      const error = new Error('A valid desktop address and port are required.');
      this.setStatus('error');
      return Promise.reject(error);
    }

    if (
      this.status === 'connected' &&
      this.host === nextHost &&
      this.port === nextPort &&
      this.socket?.readyState === WebSocket.OPEN
    ) {
      return Promise.resolve();
    }

    this.host = nextHost;
    this.port = nextPort;
    this.manuallyDisconnected = false;
    this.clearReconnectTimer();
    this.closeCurrentSocket();
    this.setStatus(isReconnect ? 'reconnecting' : 'connecting');

    return new Promise((resolve, reject) => {
      let settled = false;
      let socket;

      try {
        socket = new WebSocket(`ws://${this.host}:${this.port}`);
      } catch {
        const error = new Error(WAITING_FOR_DESKTOP_MESSAGE);
        this.setStatus('error');
        this.scheduleReconnect();
        reject(error);
        return;
      }

      this.socket = socket;

      const settleFailure = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      this.connectTimeout = setTimeout(() => {
        if (socket !== this.socket || socket.readyState === WebSocket.OPEN) return;
        this.setStatus('error');
        settleFailure(new Error('Connection attempt timed out.'));
        socket.close();
      }, CONNECT_TIMEOUT_MS);

      socket.onopen = () => {
        if (socket !== this.socket) return;
        this.clearConnectTimeout();
        settled = true;
        this.setStatus('connected');
        resolve();
      };

      socket.onmessage = (event) => {
        if (socket !== this.socket) return;
        this.handleMessage(event.data);
      };

      socket.onerror = () => {
        if (socket !== this.socket) return;
        this.clearConnectTimeout();
        this.setStatus('error');
        settleFailure(new Error(WAITING_FOR_DESKTOP_MESSAGE));
        if (
          socket.readyState === WebSocket.CONNECTING ||
          socket.readyState === WebSocket.OPEN
        ) {
          socket.close();
        } else {
          this.scheduleReconnect();
        }
      };

      socket.onclose = () => {
        if (socket !== this.socket) return;
        this.clearConnectTimeout();
        this.socket = null;
        settleFailure(new Error(WAITING_FOR_DESKTOP_MESSAGE));
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };
    });
  }

  disconnect() {
    this.manuallyDisconnected = true;
    this.clearReconnectTimer();
    this.clearConnectTimeout();
    this.closeCurrentSocket();
    this.setStatus('disconnected');
  }

  reconnect() {
    if (!this.host || !this.port) {
      this.setStatus('disconnected');
      return Promise.reject(new Error('Desktop connection is not configured.'));
    }

    return this.open(this.host, this.port, true);
  }

  sendCommand(message, requestMetadata) {
    const normalizedMessage = message.trim();
    if (
      !normalizedMessage ||
      !requestMetadata?.requestId ||
      !requestMetadata?.deviceId ||
      !requestMetadata?.sessionToken ||
      !Number.isFinite(requestMetadata?.timestamp) ||
      this.status !== 'connected' ||
      this.socket?.readyState !== WebSocket.OPEN
    ) {
      return false;
    }

    const payload = {
      type: 'command',
      message: normalizedMessage,
      requestId: requestMetadata.requestId,
      timestamp: requestMetadata.timestamp,
      deviceId: requestMetadata.deviceId,
      sessionToken: requestMetadata.sessionToken,
    };

    try {
      this.socket.send(JSON.stringify(payload));
      return payload;
    } catch {
      this.setStatus('error');
      this.socket.close();
      return false;
    }
  }

  sendPairRequest(deviceId, deviceName, token) {
    if (
      !deviceId ||
      !deviceName.trim() ||
      !token.trim() ||
      this.status !== 'connected' ||
      this.socket?.readyState !== WebSocket.OPEN
    ) {
      return false;
    }

    const payload = {
      type: 'pair',
      deviceId,
      deviceName: deviceName.trim(),
      token: token.trim(),
    };

    try {
      this.socket.send(JSON.stringify(payload));
      return true;
    } catch {
      this.setStatus('error');
      this.socket.close();
      return false;
    }
  }

  sendFileTransfer({
    requestId,
    timestamp,
    deviceId,
    sessionToken,
    fileName,
    fileSize,
    data,
    hash,
  }) {
    if (
      !requestId ||
      !deviceId ||
      !sessionToken ||
      !Number.isFinite(timestamp) ||
      !fileName ||
      !Number.isFinite(fileSize) ||
      typeof data !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(hash) ||
      this.status !== 'connected' ||
      this.socket?.readyState !== WebSocket.OPEN
    ) {
      return false;
    }

    const payload = {
      type: 'file-transfer',
      requestId,
      timestamp,
      deviceId,
      sessionToken,
      fileName,
      fileSize,
      data,
      hash,
    };

    try {
      this.socket.send(JSON.stringify(payload));
      return true;
    } catch {
      this.setStatus('error');
      this.socket.close();
      return false;
    }
  }

  getStatus() {
    return this.status;
  }

  getConnectionConfig() {
    return {
      serverIp: this.host,
      serverPort: this.port,
    };
  }

  subscribeToStatus(listener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  subscribeToMessages(listener) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  handleMessage(rawMessage) {
    try {
      const message = JSON.parse(rawMessage);

      if (message.type === 'status' && CONNECTION_STATES.has(message.status)) {
        this.setStatus(message.status);
        if (
          (message.status === 'disconnected' || message.status === 'error') &&
          this.socket?.readyState === WebSocket.OPEN
        ) {
          this.socket.close();
        }
        return;
      }

      if (
        message.type === 'response' ||
        message.type === 'error' ||
        message.type === 'pair-success' ||
        message.type === 'pair-failed' ||
        message.type === 'incoming-file' ||
        message.type === 'permissions' ||
        message.type === 'session-expired' ||
        message.type === 'session-renewed' ||
        message.type === 'authentication-failed' ||
        message.type === 'authentication-failure' ||
        message.type === 'auth-failed' ||
        message.type === 'auth-failure'
      ) {
        this.messageListeners.forEach((listener) => listener(message));
      }
    } catch {
      this.messageListeners.forEach((listener) =>
        listener({
          type: 'error',
          message: 'OpenX Desktop returned an invalid response.',
          timestamp: Date.now(),
        }),
      );
    }
  }

  setStatus(status) {
    if (!CONNECTION_STATES.has(status) || this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  scheduleReconnect() {
    if (
      this.manuallyDisconnected ||
      this.reconnectTimer ||
      !this.host ||
      !this.port
    ) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnect().catch(() => {
        // A failed reconnect schedules the next attempt from its close handler.
      });
    }, RECONNECT_DELAY_MS);
  }

  closeCurrentSocket() {
    if (!this.socket) return;

    const socket = this.socket;
    this.socket = null;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    if (
      socket.readyState === WebSocket.CONNECTING ||
      socket.readyState === WebSocket.OPEN
    ) {
      socket.close();
    }
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

export const websocketService = new OpenXWebSocketService();
