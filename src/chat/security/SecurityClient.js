/**
 * Mobile HTTP client for Phase 14 Security Platform endpoints.
 */
export class SecurityClient {
  /**
   * Creates security client.
   * @param {object} options Client options.
   */
  constructor(options = {}) {
    this.config = options.config || {};
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  createPin(payload) { return this.request('/security/pin/create', 'POST', payload); }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  verifyPin(payload) { return this.request('/security/pin/verify', 'POST', payload); }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  updatePin(payload) { return this.request('/security/pin/update', 'POST', payload); }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  approveDevice(payload) { return this.request('/security/device/approve', 'POST', payload); }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  revokeDevice(payload) { return this.request('/security/device/revoke', 'POST', payload); }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  startRecovery(payload) { return this.request('/security/recovery/start', 'POST', payload); }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  completeRecovery(payload) { return this.request('/security/recovery/complete', 'POST', payload); }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Result. */
  loginHistory(accountId) { return this.request(`/security/login/history?accountId=${encodeURIComponent(accountId)}`, 'GET'); }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Result. */
  trustedDevices(accountId) { return this.request(`/security/trusted/devices?accountId=${encodeURIComponent(accountId)}`, 'GET'); }

  /**
   * Executes request.
   * @param {string} route Route.
   * @param {string} method Method.
   * @param {object|null} body Body.
   * @returns {Promise<object>} Data.
   */
  async request(route, method, body = null) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch is not available for security client.');
    const base = String(this.config.apiBaseUrl || 'http://localhost:8090').replace(/\/+$/, '');
    const response = await this.fetchImpl(`${base}${route}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json();
    if (!response.ok || json.ok === false) {
      const error = new Error(json.error?.message || `Security request failed: ${response.status}`);
      error.code = json.error?.code || 'security.http_failed';
      error.statusCode = response.status;
      throw error;
    }
    return json.data;
  }
}

export default SecurityClient;
