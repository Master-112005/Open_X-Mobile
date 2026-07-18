/**
 * Mobile HTTP client for Phase 7 mailbox endpoints.
 */
export class MailboxClient {
  /**
   * Creates mailbox client.
   * @param {object} options Client options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /** @param {object} payload Envelope payload. @returns {Promise<object>} Stored envelope. */
  storeEnvelope(payload) { return this.request('/mailbox/envelope', 'POST', payload); }

  /** @param {string} deviceId DeviceID. @param {number} lastAcknowledgedSequence Sequence. @param {number|null} limit Limit. @returns {Promise<object>} Sync payload. */
  retrieveMailbox(deviceId, lastAcknowledgedSequence = 0, limit = null) {
    const query = new URLSearchParams({ lastAcknowledgedSequence: String(lastAcknowledgedSequence) });
    if (limit) query.set('limit', String(limit));
    return this.request(`/mailbox/${encodeURIComponent(deviceId)}?${query.toString()}`, 'GET');
  }

  /** @param {object} payload ACK payload. @returns {Promise<object>} ACK result. */
  acknowledge(payload) { return this.request('/mailbox/ack', 'POST', payload); }

  /** @param {string} deviceId DeviceID. @returns {Promise<object>} Mailbox status. */
  status(deviceId) { return this.request(`/mailbox/status/${encodeURIComponent(deviceId)}`, 'GET'); }

  /** @param {string} envelopeId EnvelopeID. @returns {Promise<object>} Delete result. */
  deleteEnvelope(envelopeId) { return this.request(`/mailbox/envelope/${encodeURIComponent(envelopeId)}`, 'DELETE'); }

  /**
   * Executes HTTP request.
   * @param {string} route Route.
   * @param {string} method Method.
   * @param {object|null} body Body.
   * @returns {Promise<object>} Response data.
   */
  async request(route, method, body = null) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch is not available for mailbox client.');
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
        const error = new Error(json.error?.message || `Mailbox request failed: ${response.status}`);
        error.code = json.error?.code || 'mailbox.http_failed';
        error.statusCode = response.status;
        throw error;
      }
      return json.data;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export default MailboxClient;
