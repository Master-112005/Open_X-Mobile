/**
 * Mobile contact request input validation.
 */
export class RequestValidation {
  /**
   * Creates request validation.
   * @param {object} options Validator options.
   */
  constructor(options = {}) {
    this.config = options.config;
  }

  /**
   * Validates an AccountID.
   * @param {*} value AccountID.
   * @returns {string} AccountID.
   */
  accountId(value) {
    const accountId = String(value || '').trim().toLowerCase();
    if (!/^acc_[a-f0-9]{64}$/.test(accountId)) throw new Error('AccountID is invalid.');
    return accountId;
  }

  /**
   * Validates a contact RequestID.
   * @param {*} value RequestID.
   * @returns {string} RequestID.
   */
  requestId(value) {
    const requestId = String(value || '').trim().toLowerCase();
    if (!/^creq_[a-f0-9]{64}$/.test(requestId)) throw new Error('Contact RequestID is invalid.');
    return requestId;
  }

  /**
   * Validates a Phase 5 opaque contact token.
   * @param {*} value Opaque contact token.
   * @returns {string} Token.
   */
  opaqueContactToken(value) {
    const token = String(value || '').trim();
    if (!/^oct_v1_[A-Za-z0-9_-]{32,160}$/.test(token)) throw new Error('Opaque contact token is invalid.');
    return token;
  }

  /**
   * Validates an optional request preview.
   * @param {*} value Preview.
   * @returns {string|null} Preview.
   */
  messagePreview(value) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const preview = String(value).trim();
    if (preview.length > this.config.maxMessagePreviewLength) throw new Error('Contact request preview is too long.');
    return preview;
  }

  /**
   * Validates a private nickname.
   * @param {*} value Nickname.
   * @returns {string} Nickname.
   */
  nickname(value) {
    const nickname = String(value || '').trim();
    if (!nickname || nickname.length > this.config.maxNicknameLength) throw new Error('Nickname length is invalid.');
    return nickname;
  }

  /**
   * Validates an optional reason.
   * @param {*} value Reason.
   * @returns {string|null} Reason.
   */
  reason(value) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const reason = String(value).trim();
    if (reason.length > 160) throw new Error('Reason is too long.');
    return reason;
  }

  /**
   * Sanitizes metadata.
   * @param {*} value Metadata.
   * @returns {object} Safe metadata.
   */
  metadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      if (/^[a-z0-9_-]{1,40}$/i.test(key) && ['string', 'number', 'boolean'].includes(typeof child)) output[key] = child;
    }
    return output;
  }
}

export default RequestValidation;
