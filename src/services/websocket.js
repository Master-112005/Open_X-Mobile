const RECONNECT_DELAY_MS = 5000;
const CONNECT_TIMEOUT_MS = 8000;
const FILE_TRANSFER_CHUNK_BYTES = 256 * 1024;
const FILE_TRANSFER_CHUNK_BASE64_LENGTH = Math.ceil(FILE_TRANSFER_CHUNK_BYTES / 3) * 4;
const FILE_TRANSFER_MAX_BUFFERED_BYTES = 2 * 1024 * 1024;
const FILE_TRANSFER_DRAIN_DELAY_MS = 8;
const FILE_TRANSFER_ACK_TIMEOUT_MS = 30000;
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  recentTransferErrors = new Map();

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
      this.socket?.close?.();
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

  async sendFileTransfer({
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

    try {
      const transferId = requestId;
      const chunkCount = Math.max(
        1,
        Math.ceil(data.length / FILE_TRANSFER_CHUNK_BASE64_LENGTH),
      );
      const startedPromise = this.waitForTransferMessage(transferId, ['file-transfer-started']);

      this.sendJson({
        type: 'file-transfer-start',
        requestId,
        transferId,
        timestamp,
        deviceId,
        sessionToken,
        fileName,
        fileSize,
        sha256: hash,
        hash,
        chunkCount,
      });
      await startedPromise;

      for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
        const offset = chunkIndex * FILE_TRANSFER_CHUNK_BASE64_LENGTH;
        const chunk = data.slice(offset, offset + FILE_TRANSFER_CHUNK_BASE64_LENGTH);
        this.sendJson({
          type: 'file-transfer-chunk',
          requestId: `${requestId}:${chunkIndex}`,
          transferId,
          timestamp: Date.now(),
          deviceId,
          sessionToken,
          chunkIndex,
          data: chunk,
        });
        await this.waitForSocketDrain();
        this.throwRememberedTransferError(transferId);
      }

      this.throwRememberedTransferError(transferId);
      const successPromise = this.waitForTransferMessage(transferId, ['file-transfer-success']);
      this.sendJson({
        type: 'file-transfer-complete',
        requestId: `${requestId}:complete`,
        transferId,
        timestamp: Date.now(),
        deviceId,
        sessionToken,
      });
      await successPromise;
      this.recentTransferErrors.delete(transferId);
      return true;
    } catch (error) {
      this.setStatus('error');
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.close();
      }
      throw error;
    }
  }

  waitForTransferMessage(transferId, expectedTypes) {
    const expected = new Set(expectedTypes);
    return new Promise((resolve, reject) => {
      const rememberedError = this.recentTransferErrors.get(transferId);
      if (rememberedError) {
        this.recentTransferErrors.delete(transferId);
        reject(new Error(rememberedError));
        return;
      }
      const cleanup = () => {
        clearTimeout(timer);
        this.messageListeners.delete(listener);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('File transfer timed out. Reconnect and try again.'));
      }, FILE_TRANSFER_ACK_TIMEOUT_MS);
      const listener = (message) => {
        const messageTransferId = String(message?.transferId || '').trim();
        if (messageTransferId && messageTransferId !== transferId) return;
        if (message.type === 'error') {
          cleanup();
          this.recentTransferErrors.delete(transferId);
          reject(new Error(message.message || 'File transfer failed.'));
          return;
        }
        if (!expected.has(message.type)) return;
        cleanup();
        resolve(message);
      };

      this.messageListeners.add(listener);
    });
  }

  throwRememberedTransferError(transferId) {
    const rememberedError = this.recentTransferErrors.get(transferId);
    if (!rememberedError) return;
    this.recentTransferErrors.delete(transferId);
    throw new Error(rememberedError);
  }

  sendJson(payload) {
    if (
      this.status !== 'connected' ||
      this.socket?.readyState !== WebSocket.OPEN
    ) {
      throw new Error('Desktop connection is not open.');
    }
    this.socket.send(JSON.stringify(payload));
  }

  async waitForSocketDrain() {
    while (
      this.socket?.readyState === WebSocket.OPEN &&
      Number(this.socket?.bufferedAmount || 0) > FILE_TRANSFER_MAX_BUFFERED_BYTES
    ) {
      await sleep(FILE_TRANSFER_DRAIN_DELAY_MS);
    }

    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error('Desktop connection closed during file transfer.');
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
        message.type === 'file-transfer' ||
        message.type === 'file-transfer-started' ||
        message.type === 'file-transfer-progress' ||
        message.type === 'file-transfer-success' ||
        message.type === 'permissions' ||
        message.type === 'session-expired' ||
        message.type === 'session-renewed' ||
        message.type === 'authentication-failed' ||
        message.type === 'authentication-failure' ||
        message.type === 'auth-failed' ||
        message.type === 'auth-failure'
      ) {
        if (message.type === 'error' && message.transferId) {
          this.recentTransferErrors.set(
            String(message.transferId),
            message.message || 'File transfer failed.',
          );
        }
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
