/**
 * Mobile contact discovery configuration.
 */
export class DiscoveryConfiguration {
  /**
   * Creates discovery configuration.
   * @param {object} options Configuration overrides.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || 'http://localhost:8090').replace(/\/+$/, '');
    this.requestTimeoutMs = Number(options.requestTimeoutMs || 15000);
    this.defaultCountryCode = options.defaultCountryCode || null;
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates configuration.
   */
  validate() {
    if (!/^https?:\/\//i.test(this.apiBaseUrl)) throw new Error('Discovery API base URL must be http:// or https://.');
    if (this.requestTimeoutMs < 1000) throw new Error('Discovery request timeout is too small.');
    if (this.defaultCountryCode && !/^[A-Z]{2}$/.test(String(this.defaultCountryCode).toUpperCase())) throw new Error('Discovery default country must be ISO-3166 alpha-2.');
  }
}

export default DiscoveryConfiguration;
