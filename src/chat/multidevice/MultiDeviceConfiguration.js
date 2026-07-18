/**
 * Mobile Phase 10 multi-device configuration.
 */
export class MultiDeviceConfiguration {
  /** @param {object} options Overrides. */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || 'http://localhost:8090').replace(/\/+$/, '');
    this.requestTimeoutMs = Number(options.requestTimeoutMs || 15000);
    this.maxRetries = Number(options.maxRetries || 5);
    this.storageKey = options.storageKey || '@openx-chat/multi-device';
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates configuration.
   */
  validate() {
    if (!/^https?:\/\//i.test(this.apiBaseUrl)) throw new Error('Multi-device API URL must be http:// or https://.');
    if (this.requestTimeoutMs < 1000) throw new Error('Multi-device request timeout is too small.');
    if (this.maxRetries < 0) throw new Error('Multi-device max retries must be >= 0.');
  }
}

export default MultiDeviceConfiguration;
