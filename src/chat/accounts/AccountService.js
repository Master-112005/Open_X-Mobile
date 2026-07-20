/**
 * Mobile API client for OpenX Chat username/password accounts.
 */
export class AccountService {
  /**
   * Creates an account service.
   * @param {object} options Service options.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || 'https://openx-chat-server.onrender.com').replace(/\/+$/, '');
    this.requestTimeoutMs = Number(options.requestTimeoutMs || 15000);
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /** @param {string} username Username. @returns {Promise<object>} Availability. */
  checkUsername(username) {
    return this.request(`/account/username/${encodeURIComponent(this.username(username))}`, 'GET');
  }

  /** @param {object} payload Registration payload. @returns {Promise<object>} Account. */
  register(payload) {
    return this.request('/account/register', 'POST', {
      username: this.username(payload.username),
      password: this.password(payload.password),
    });
  }

  /** @param {object} payload Login payload. @returns {Promise<object>} Account. */
  login(payload) {
    return this.request('/account/login', 'POST', {
      username: this.username(payload.username),
      password: this.password(payload.password),
    });
  }

  /** @param {object} payload Device payload. @returns {Promise<object>} Device registration response. */
  registerDevice(payload) {
    return this.request('/device/register', 'POST', payload);
  }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Public account. */
  getAccount(accountId) {
    return this.request(`/account/${encodeURIComponent(accountId)}`, 'GET');
  }

  /** @param {object} payload Discovery payload. @returns {Promise<object>} Opaque token response. */
  lookupUser(payload) {
    return this.request('/discovery/lookup', 'POST', {
      username: this.username(payload.username),
      metadata: payload.metadata || {},
    });
  }

  /** @param {object} payload Contact request payload. @returns {Promise<object>} Request. */
  createContactRequest(payload) {
    return this.request('/contact/request', 'POST', payload);
  }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Pending requests. */
  listIncomingRequests(accountId) {
    return this.request(`/contact/request/pending?accountId=${encodeURIComponent(accountId)}`, 'GET');
  }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Outgoing requests. */
  listOutgoingRequests(accountId) {
    return this.request(`/contact/request/outgoing?accountId=${encodeURIComponent(accountId)}`, 'GET');
  }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Trusted relationships. */
  listRelationships(accountId) {
    return this.request(`/contact/relationships?accountId=${encodeURIComponent(accountId)}`, 'GET');
  }

  /** @param {object} payload Accept request payload. @returns {Promise<object>} Accepted request. */
  acceptRequest(payload) {
    return this.request('/contact/request/accept', 'POST', payload);
  }

  /** @param {object} payload Delete/reject request payload. @returns {Promise<object>} Deleted request. */
  deleteRequest(payload) {
    return this.request('/contact/request/delete', 'POST', payload);
  }

  /** @param {object} payload Message payload. @returns {Promise<object>} Send result. */
  sendMessage(payload) {
    return this.request('/messages/send', 'POST', payload);
  }

  /**
   * Executes a JSON API request.
   * @param {string} route API route.
   * @param {string} method HTTP method.
   * @param {object|null} body JSON body.
   * @returns {Promise<object>} Response data.
   */
  async request(route, method, body = null) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch is not available for OpenX Chat.');
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.requestTimeoutMs) : null;
    try {
      const response = await this.fetchImpl(`${this.apiBaseUrl}${route}`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
      const text = await response.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        const error = new Error(`OpenX Chat Server returned an unreadable response for ${route}.`);
        error.code = 'chat.response_invalid';
        error.statusCode = response.status;
        throw error;
      }
      if (!response.ok || json.ok === false) {
        const error = new Error(json.error?.message || `OpenX Chat request failed: ${response.status}`);
        error.code = json.error?.code || 'chat.http_failed';
        error.statusCode = response.status;
        throw error;
      }
      return json.data;
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeout = new Error('OpenX Chat Server did not respond in time. Check the connection and try again.');
        timeout.code = 'chat.request_timeout';
        throw timeout;
      }
      if (/network request failed|fetch failed/i.test(String(error.message || ''))) {
        const network = new Error(`OpenX Chat Server is not reachable at ${this.apiBaseUrl}.`);
        network.code = 'chat.server_unreachable';
        throw network;
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** @param {*} value Raw username. @returns {string} Username. */
  username(value) {
    const rawUsername = String(value || '').trim();
    const username = rawUsername.startsWith('@') ? rawUsername.slice(1).trim() : rawUsername;
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
      throw new Error('Username must be 3-32 letters, numbers, dots, hyphens, or underscores. A leading @ is optional.');
    }
    return username;
  }

  /** @param {*} value Raw password. @returns {string} Password. */
  password(value) {
    const password = String(value || '');
    if (password.length < 10) throw new Error('Password must be at least 10 characters.');
    if (password.length > 128) throw new Error('Password must be 128 characters or fewer.');
    if (!/[a-z]/.test(password)) throw new Error('Password must include a lowercase letter.');
    if (!/[A-Z]/.test(password)) throw new Error('Password must include an uppercase letter.');
    if (!/\d/.test(password)) throw new Error('Password must include a number.');
    if (!/[^\w\s]/.test(password)) throw new Error('Password must include a special character.');
    return password;
  }
}

export default AccountService;
