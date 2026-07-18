/**
 * Mobile Phase 11 connection engine configuration.
 */
export class ConnectionConfiguration {
  /** @param {object} options Overrides. */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || 'http://localhost:8090').replace(/\/+$/, '');
    this.heartbeatIntervalMs = this.number(options.heartbeatIntervalMs, 30000);
    this.heartbeatTimeoutMs = this.number(options.heartbeatTimeoutMs, 10000);
    this.reconnectMinDelayMs = this.number(options.reconnectMinDelayMs, 1000);
    this.reconnectMaxDelayMs = this.number(options.reconnectMaxDelayMs, 30000);
    this.backgroundTimeoutMs = this.number(options.backgroundTimeoutMs, 30000);
    this.foregroundTimeoutMs = this.number(options.foregroundTimeoutMs, 15000);
    this.presenceTimeoutMs = this.number(options.presenceTimeoutMs, 120000);
    this.sessionTimeoutMs = this.number(options.sessionTimeoutMs, 3600000);
    this.synchronizationIntervalMs = this.number(options.synchronizationIntervalMs, 30000);
    this.pushProvider = options.pushProvider || 'fcm';
    this.platform = options.platform || 'android';
    this.disconnectInBackground = options.disconnectInBackground !== false;
    this.syncOnForeground = options.syncOnForeground !== false;
    this.validate();
    Object.freeze(this);
  }

  /** @param {*} value Value. @param {number} fallback Fallback. @returns {number} Number. */
  number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /** Validates configuration. */
  validate() {
    if (!/^https?:\/\//i.test(this.apiBaseUrl)) throw new Error('Mobile connection API URL must be http:// or https://.');
    if (this.heartbeatIntervalMs < 1000) throw new Error('Mobile connection heartbeat interval is too small.');
    if (this.heartbeatTimeoutMs < 1000) throw new Error('Mobile connection heartbeat timeout is too small.');
    if (this.reconnectMaxDelayMs < this.reconnectMinDelayMs) throw new Error('Mobile connection reconnect max delay must be >= min delay.');
    if (!['fcm', 'apns', 'local'].includes(this.pushProvider)) throw new Error('Mobile push provider is invalid.');
  }
}

export default ConnectionConfiguration;
