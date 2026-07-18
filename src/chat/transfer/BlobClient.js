/**
 * Mobile HTTP client for Phase 12 file-transfer endpoints.
 */
export class BlobClient {
  /**
   * Creates client.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  upload(payload) { return this.request('/file/upload', 'POST', payload); }

  /** @param {string} blobToken Blob token. @returns {Promise<object>} Result. */
  download(blobToken) { return this.request(`/file/download/${encodeURIComponent(blobToken)}`, 'GET'); }

  /** @param {object} payload Payload. @returns {Promise<object>} Result. */
  acknowledge(payload) { return this.request('/file/ack', 'POST', payload); }

  /** @param {string} blobToken Blob token. @returns {Promise<object>} Result. */
  deleteBlob(blobToken) { return this.request(`/file/blob/${encodeURIComponent(blobToken)}`, 'DELETE'); }

  /** @param {string} transferId TransferID. @returns {Promise<object>} Result. */
  status(transferId) { return this.request(`/file/status/${encodeURIComponent(transferId)}`, 'GET'); }

  /**
   * Executes HTTP request.
   * @param {string} route Route.
   * @param {string} method Method.
   * @param {object|null} body Body.
   * @returns {Promise<object>} Data.
   */
  async request(route, method, body = null) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch is not available for file transfer client.');
    const response = await this.fetchImpl(`${this.config.apiBaseUrl}${route}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json();
    if (!response.ok || json.ok === false) {
      const error = new Error(json.error?.message || `File transfer request failed: ${response.status}`);
      error.code = json.error?.code || 'file.http_failed';
      error.statusCode = response.status;
      throw error;
    }
    return json.data;
  }
}

export default BlobClient;
