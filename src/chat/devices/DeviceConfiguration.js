/**
 * Mobile trusted device configuration.
 */
export class DeviceConfiguration {
  /**
   * Creates device configuration.
   * @param {object} options Overrides.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || 'https://openx-chat-server.onrender.com').replace(/\/+$/, '');
    this.accountId = options.accountId || null;
    this.autoRegister = options.autoRegister !== false;
    this.deviceName = options.deviceName || 'OpenX Mobile';
    this.platform = options.platform || 'mobile';
    this.platformVersion = options.platformVersion || null;
    this.applicationVersion = options.applicationVersion || '0.1.0';
    this.operatingSystem = options.operatingSystem || 'Mobile';
    this.deviceType = options.deviceType || 'Mobile';
    this.capabilities = Object.freeze(options.capabilities || ['backgroundWake', 'batteryOptimization', 'foregroundService']);
    this.storageRoot = options.storageRoot || '@openx-chat/device';
    this.requestTimeoutMs = Number(options.requestTimeoutMs || 15000);
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates configuration.
   */
  validate() {
    if (!/^https?:\/\//i.test(this.apiBaseUrl)) throw new Error('Device API base URL must be http:// or https://.');
    if (this.requestTimeoutMs < 1000) throw new Error('Device request timeout is too small.');
  }
}

export default DeviceConfiguration;
