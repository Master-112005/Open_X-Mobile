/**
 * Centralized Mobile Chat configuration.
 */
export class ChatConfiguration {
  /**
   * Creates Mobile Chat configuration.
   * @param {object} options Configuration overrides.
   */
  constructor(options = {}) {
    this.serverUrl = String(options.serverUrl || 'wss://openx-chat-server.onrender.com/ws').trim();
    this.protocolVersion = String(options.protocolVersion || '1');
    this.heartbeatIntervalMs = this.number(options.heartbeatIntervalMs, 30000);
    this.heartbeatTimeoutMs = this.number(options.heartbeatTimeoutMs, 10000);
    this.connectionTimeoutMs = this.number(options.connectionTimeoutMs, 15000);
    this.reconnectMinDelayMs = this.number(options.reconnectMinDelayMs, 1000);
    this.reconnectMaxDelayMs = this.number(options.reconnectMaxDelayMs, 30000);
    this.maxReconnectAttempts = this.number(options.maxReconnectAttempts, Infinity);
    this.backgroundReady = options.backgroundReady === true;
    this.featureFlags = Object.freeze({
      authentication: true,
      encryption: false,
      messaging: true,
      push: false,
      synchronization: true,
      multiDevice: true,
      connectionEngine: true,
      backgroundRecovery: true,
      pushWake: true,
      fileTransfer: true,
      conversations: true,
      securityPlatform: true,
      infrastructureOptimization: true,
      productionReadiness: true,
      ...(options.featureFlags || {}),
    });
    this.optimization = Object.freeze({
      maxMetricSamples: this.number(options.optimization?.maxMetricSamples, 300),
      slowOperationMs: this.number(options.optimization?.slowOperationMs, 900),
      maxLocalRecords: this.number(options.optimization?.maxLocalRecords, 5000),
      heapWarningBytes: this.number(options.optimization?.heapWarningBytes, 134217728),
      defaultSyncBatchSize: this.number(options.optimization?.defaultSyncBatchSize, 30),
      maxSyncBatchSize: this.number(options.optimization?.maxSyncBatchSize, 100),
      lowBatteryThreshold: this.number(options.optimization?.lowBatteryThreshold, 0.2),
      maxReleaseLogEntries: this.number(options.optimization?.maxReleaseLogEntries, 100),
    });
    this.validate();
    Object.freeze(this);
  }

  /**
   * Parses a number with fallback.
   * @param {*} value Candidate value.
   * @param {number} fallback Fallback number.
   * @returns {number} Parsed number.
   */
  number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /**
   * Validates configuration values.
   */
  validate() {
    if (!/^wss?:\/\//i.test(this.serverUrl)) throw new Error('Mobile Chat server URL must be ws:// or wss://.');
    if (this.heartbeatIntervalMs < 1000) throw new Error('Mobile Chat heartbeat interval is too small.');
    if (this.heartbeatTimeoutMs < 1000) throw new Error('Mobile Chat heartbeat timeout is too small.');
    if (this.connectionTimeoutMs < 1000) throw new Error('Mobile Chat connection timeout is too small.');
    if (this.reconnectMaxDelayMs < this.reconnectMinDelayMs) throw new Error('Mobile Chat reconnect max delay must be >= min delay.');
  }

  /**
   * Returns a public configuration snapshot.
   * @returns {object} Configuration snapshot.
   */
  toJSON() {
    return {
      serverUrl: this.serverUrl,
      protocolVersion: this.protocolVersion,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      heartbeatTimeoutMs: this.heartbeatTimeoutMs,
      connectionTimeoutMs: this.connectionTimeoutMs,
      reconnectMinDelayMs: this.reconnectMinDelayMs,
      reconnectMaxDelayMs: this.reconnectMaxDelayMs,
      maxReconnectAttempts: this.maxReconnectAttempts,
      backgroundReady: this.backgroundReady,
      optimization: this.optimization,
      featureFlags: this.featureFlags,
    };
  }
}

export default ChatConfiguration;
