/**
 * Mobile HTTP client for Phase 9 reliable synchronization endpoints.
 */
export class SynchronizationClient {
  /**
   * Creates synchronization client.
   * @param {object} options Client options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /** @param {object} input Sync input. @returns {Promise<object>} Sync payload. */
  synchronize(input = {}) {
    const query = new URLSearchParams({
      deviceId: String(input.deviceId || ''),
      afterSequence: String(input.afterSequence || 0),
    });
    if (input.limit) query.set('limit', String(input.limit));
    return this.request(`/sync?${query.toString()}`, 'GET');
  }

  /** @param {object} input ACK input. @returns {Promise<object>} ACK result. */
  acknowledge(input = {}) { return this.request('/sync/ack', 'POST', input); }

  /** @param {string} deviceId DeviceID. @returns {Promise<object>} Status. */
  status(deviceId) {
    const query = new URLSearchParams({ deviceId: String(deviceId || '') });
    return this.request(`/sync/status?${query.toString()}`, 'GET');
  }

  /** @param {object} input Retry input. @returns {Promise<object>} Retry result. */
  retry(input = {}) { return this.request('/sync/retry', 'POST', input); }

  /**
   * Executes HTTP request.
   * @param {string} route Route.
   * @param {string} method Method.
   * @param {object|null} body Body.
   * @returns {Promise<object>} Response data.
   */
  async request(route, method, body = null) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch is not available for synchronization client.');
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
      if (!response.ok || json.ok === false) {
        const error = new Error(json.error?.message || `Synchronization request failed: ${response.status}`);
        error.code = json.error?.code || 'sync.http_failed';
        error.statusCode = response.status;
        throw error;
      }
      return json.data;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export default SynchronizationClient;
