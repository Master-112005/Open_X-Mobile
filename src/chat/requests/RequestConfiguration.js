/**
 * Mobile contact request configuration.
 */
export class RequestConfiguration {
  /**
   * Creates request configuration.
   * @param {object} options Configuration overrides.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || 'https://openx-chat-server.onrender.com').replace(/\/+$/, '');
    this.requestTimeoutMs = Number(options.requestTimeoutMs || 15000);
    this.maxMessagePreviewLength = Number(options.maxMessagePreviewLength || 160);
    this.maxNicknameLength = Number(options.maxNicknameLength || 80);
    this.nicknameStorageKey = options.nicknameStorageKey || '@openx-chat/contact-request-nicknames';
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates configuration.
   */
  validate() {
    if (!/^https?:\/\//i.test(this.apiBaseUrl)) throw new Error('Contact request API base URL must be http:// or https://.');
    if (this.requestTimeoutMs < 1000) throw new Error('Contact request timeout is too small.');
    if (this.maxMessagePreviewLength < 0 || this.maxMessagePreviewLength > 1000) throw new Error('Contact request preview length is invalid.');
    if (this.maxNicknameLength < 1 || this.maxNicknameLength > 160) throw new Error('Contact request nickname length is invalid.');
  }
}

export default RequestConfiguration;
