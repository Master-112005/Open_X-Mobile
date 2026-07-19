/**
 * Mobile encrypted mailbox client configuration.
 */
export class MailboxConfiguration {
  /**
   * Creates mailbox configuration.
   * @param {object} options Configuration overrides.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || 'https://openx-chat-server.onrender.com').replace(/\/+$/, '');
    this.requestTimeoutMs = Number(options.requestTimeoutMs || 15000);
    this.maxEnvelopeSizeBytes = Number(options.maxEnvelopeSizeBytes || 262144);
    this.sequenceStorageKey = options.sequenceStorageKey || '@openx-chat/mailbox-sequences';
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates configuration.
   */
  validate() {
    if (!/^https?:\/\//i.test(this.apiBaseUrl)) throw new Error('Mailbox API base URL must be http:// or https://.');
    if (this.requestTimeoutMs < 1000) throw new Error('Mailbox request timeout is too small.');
    if (this.maxEnvelopeSizeBytes < 1) throw new Error('Mailbox envelope size limit is invalid.');
  }
}

export default MailboxConfiguration;
