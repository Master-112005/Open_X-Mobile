/**
 * Mobile API client for Phase 6 contact request endpoints.
 */
export class RequestService {
  /**
   * Creates a request service.
   * @param {object} options Service options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /** @param {object} payload Request payload. @returns {Promise<object>} Response data. */
  createRequest(payload) { return this.request('/contact/request', 'POST', payload); }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Pending response. */
  listPendingIncoming(accountId) { return this.request(`/contact/request/pending?accountId=${encodeURIComponent(accountId)}`, 'GET'); }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Outgoing response. */
  listOutgoing(accountId) { return this.request(`/contact/request/outgoing?accountId=${encodeURIComponent(accountId)}`, 'GET'); }

  /** @param {object} payload Accept payload. @returns {Promise<object>} Response data. */
  acceptRequest(payload) { return this.request('/contact/request/accept', 'POST', payload); }

  /** @param {object} payload Delete payload. @returns {Promise<object>} Response data. */
  deleteRequest(payload) { return this.request('/contact/request/delete', 'POST', payload); }

  /** @param {object} payload Block payload. @returns {Promise<object>} Response data. */
  blockRequest(payload) { return this.request('/contact/request/block', 'POST', payload); }

  /** @param {object} payload Cancel payload. @returns {Promise<object>} Response data. */
  cancelRequest(payload) { return this.request('/contact/request/cancel', 'POST', payload); }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Block list response. */
  listBlockedAccounts(accountId) { return this.request(`/contact/block/list?accountId=${encodeURIComponent(accountId)}`, 'GET'); }

  /** @param {object} payload Remove block payload. @returns {Promise<object>} Response data. */
  unblockAccount(payload) { return this.request('/contact/block/remove', 'POST', payload); }

  /**
   * Executes HTTP request.
   * @param {string} route Route.
   * @param {string} method HTTP method.
   * @param {object|null} body Body.
   * @returns {Promise<object>} Response data.
   */
  async request(route, method, body = null) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch is not available for contact request service.');
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
        const error = new Error(json.error?.message || `Contact request failed: ${response.status}`);
        error.code = json.error?.code || 'request.http_failed';
        error.statusCode = response.status;
        throw error;
      }
      return json.data;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export default RequestService;
