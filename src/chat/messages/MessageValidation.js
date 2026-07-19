/**
 * Mobile message validator.
 */
export class MessageValidation {
  /**
   * Creates validator.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
  }

  /**
   * Validates outgoing plaintext.
   * @param {object} input Input.
   * @returns {object} Validated input.
   */
  outgoing(input = {}) {
    const messageType = this.messageType(input.messageType || 'Text');
    const plaintext = String(input.plaintext ?? input.text ?? '');
    if (!plaintext) throw new Error('Message text is required.');
    if (new TextEncoder().encode(plaintext).byteLength > this.config.maxMessageSizeBytes) throw new Error('Message is too large.');
    return {
      relationshipId: this.relationshipId(input.relationshipId),
      senderAccountId: this.accountId(input.senderAccountId),
      senderDeviceId: this.deviceId(input.senderDeviceId),
      recipientAccountId: this.accountId(input.recipientAccountId),
      recipientDeviceId: input.recipientDeviceId ? this.deviceId(input.recipientDeviceId) : null,
      messageType,
      plaintext,
      metadata: this.metadata(input.metadata),
    };
  }

  /** @param {*} value AccountID. @returns {string} AccountID. */
  accountId(value) {
    const accountId = String(value || '').trim().toLowerCase();
    if (!/^acc_[a-f0-9]{64}$/.test(accountId)) throw new Error('AccountID is invalid.');
    return accountId;
  }

  /** @param {*} value DeviceID. @returns {string} DeviceID. */
  deviceId(value) {
    const deviceId = String(value || '').trim().toLowerCase();
    if (!/^dev_[a-f0-9]{64}$/.test(deviceId)) throw new Error('DeviceID is invalid.');
    return deviceId;
  }

  /** @param {*} value RelationshipID. @returns {string} RelationshipID. */
  relationshipId(value) {
    const relationshipId = String(value || '').trim().toLowerCase();
    if (!/^rel_[a-f0-9]{64}$/.test(relationshipId)) throw new Error('RelationshipID is invalid.');
    return relationshipId;
  }

  /** @param {*} value Type. @returns {string} Type. */
  messageType(value) {
    const type = String(value || 'Text').trim();
    if (!this.config.supportedTypes.includes(type)) throw new Error('Only Text and Emoji are enabled in Phase 8.');
    return type;
  }

  /** @param {*} value Metadata. @returns {object} Metadata. */
  metadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, child]) => (
      /^[a-z0-9_-]{1,40}$/i.test(key) && ['string', 'number', 'boolean'].includes(typeof child)
    )));
  }
}

export default MessageValidation;
