/**
 * Mobile API client for Phase 5 contact discovery endpoints.
 */
export class DiscoveryService {
  /**
   * Creates a discovery service.
   * @param {object} options Service options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /** @param {object} payload Lookup payload. @returns {Promise<object>} Response data. */
  lookup(payload) { return this.request('/discovery/lookup', 'POST', payload); }

  /** @param {object} payload Token payload. @returns {Promise<object>} Response data. */
  validateToken(payload) { return this.request('/discovery/token/validate', 'POST', payload); }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Settings. */
  getSettings(accountId) { return this.request(`/discovery/settings/${encodeURIComponent(accountId)}`, 'GET'); }

  /** @param {object} payload Settings payload. @returns {Promise<object>} Settings. */
  updateSettings(payload) { return this.request('/discovery/settings', 'PUT', payload); }

  /**
   * Executes HTTP request.
   * @param {string} route Route.
   * @param {string} method Method.
   * @param {object|null} body Body.
   * @returns {Promise<object>} Data.
   */
  async request(route, method, body = null) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch is not available for discovery service.');
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.config.requestTimeoutMs) : null;
    try {
      const response = await this.fetchImpl(`${this.config.apiBaseUrl}${route}`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
      const json = await response.json();
      if (!response.ok || json.ok === false) throw new Error(json.error?.message || `Discovery request failed: ${response.status}`);
      return json.data;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export default DiscoveryService;
