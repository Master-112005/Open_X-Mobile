/**
 * Mobile HTTP client for Phase 10 multi-device endpoints.
 */
export class MultiDeviceClient {
  /** @param {object} options Client options. */
  constructor(options = {}) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Devices. */
  listDevices(accountId) { return this.request(`/account/${encodeURIComponent(accountId)}/devices`, 'GET'); }

  /** @param {object} input Sync input. @returns {Promise<object>} Sync result. */
  synchronizeDevice(input = {}) { return this.request('/device/synchronize', 'POST', input); }

  /** @param {object} input Consistency input. @returns {Promise<object>} Consistency result. */
  validateConsistency(input = {}) { return this.request('/device/consistency', 'POST', input); }

  /** @param {string} deviceId DeviceID. @returns {Promise<object>} Device status. */
  status(deviceId) {
    const query = new URLSearchParams({ deviceId: String(deviceId || '') });
    return this.request(`/device/status?${query.toString()}`, 'GET');
  }

  /**
   * Executes HTTP request.
   * @param {string} route Route.
   * @param {string} method Method.
   * @param {object|null} body Body.
   * @returns {Promise<object>} Response data.
   */
  async request(route, method, body = null) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch is not available for multi-device client.');
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
        const error = new Error(json.error?.message || `Multi-device request failed: ${response.status}`);
        error.code = json.error?.code || 'multi_device.http_failed';
        error.statusCode = response.status;
        throw error;
      }
      return json.data;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export default MultiDeviceClient;
