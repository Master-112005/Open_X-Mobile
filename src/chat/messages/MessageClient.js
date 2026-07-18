/**
 * Mobile HTTP client for Phase 8 message endpoints.
 */
export class MessageClient {
  /**
   * Creates message client.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  send(payload) { return this.request('/messages/send', 'POST', payload); }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  acknowledge(payload) { return this.request('/messages/ack', 'POST', payload); }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  markRead(payload) { return this.request('/messages/read', 'POST', payload); }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  retry(payload) { return this.request('/messages/retry', 'POST', payload); }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  typingStart(payload) { return this.request('/typing/start', 'POST', payload); }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  typingStop(payload) { return this.request('/typing/stop', 'POST', payload); }

  /**
   * Executes HTTP request.
   * @param {string} route Route.
   * @param {string} method Method.
   * @param {object|null} body Body.
   * @returns {Promise<object>} Data.
   */
  async request(route, method, body = null) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch is not available for message client.');
    const response = await this.fetchImpl(`${this.config.apiBaseUrl}${route}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json();
    if (!response.ok || json.ok === false) {
      const error = new Error(json.error?.message || `Message request failed: ${response.status}`);
      error.code = json.error?.code || 'message.http_failed';
      error.statusCode = response.status;
      throw error;
    }
    return json.data;
  }
}

export default MessageClient;
