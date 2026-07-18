/**
 * Mobile API client for trusted device endpoints.
 */
export class DeviceService {
  /**
   * Creates a device service.
   * @param {object} options Service options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /** @param {object} payload Device payload. @returns {Promise<object>} Response data. */
  registerDevice(payload) { return this.request('/device/register', 'POST', payload); }

  /** @param {object} payload Approval payload. @returns {Promise<object>} Response data. */
  approveDevice(payload) { return this.request('/device/approve', 'POST', payload); }

  /** @param {object} payload Revoke payload. @returns {Promise<object>} Response data. */
  revokeDevice(payload) { return this.request('/device/revoke', 'POST', payload); }

  /** @param {object} payload Remove payload. @returns {Promise<object>} Response data. */
  removeDevice(payload) { return this.request('/device/remove', 'DELETE', payload); }

  /** @param {string} deviceId DeviceID. @returns {Promise<object>} Response data. */
  getDevice(deviceId) { return this.request(`/device/${encodeURIComponent(deviceId)}`, 'GET'); }

  /**
   * Executes HTTP request.
   * @param {string} route Route.
   * @param {string} method HTTP method.
   * @param {object|null} body Request body.
   * @returns {Promise<object>} Response data.
   */
  async request(route, method, body = null) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch is not available for device service.');
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
      if (!response.ok || json.ok === false) throw new Error(json.error?.message || `Device request failed: ${response.status}`);
      return json.data;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export default DeviceService;
