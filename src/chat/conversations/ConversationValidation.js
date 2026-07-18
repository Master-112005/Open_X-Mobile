/**
 * Validates mobile local conversation input.
 */
export class ConversationValidation {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.config = options.config;
  }

  /** @param {*} value ConversationID. @returns {string} ConversationID. */
  conversationId(value) {
    const id = String(value || '').trim().toLowerCase();
    if (!/^conv_[a-f0-9]{64}$/.test(id)) throw new Error('ConversationID is invalid.');
    return id;
  }

  /** @param {*} value RelationshipID. @returns {string} RelationshipID. */
  relationshipId(value) {
    const id = String(value || '').trim().toLowerCase();
    if (!/^rel_[a-f0-9]{64}$/.test(id)) throw new Error('RelationshipID is invalid.');
    return id;
  }

  /** @param {*} value MessageID. @returns {string|null} MessageID. */
  messageId(value) {
    if (!value) return null;
    const id = String(value || '').trim().toLowerCase();
    if (!/^msg_[a-f0-9]{64}$/.test(id)) throw new Error('MessageID is invalid.');
    return id;
  }

  /** @param {*} value Metadata. @returns {object} Metadata. */
  metadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const output = {};
    Object.entries(value).forEach(([key, child]) => {
      if (/^[a-z0-9_-]{1,40}$/i.test(key) && ['string', 'number', 'boolean'].includes(typeof child)) output[key] = child;
    });
    return output;
  }

  /** @param {*} value Query. @returns {string} Query. */
  query(value) {
    return String(value || '').trim().slice(0, 200);
  }

  /** @param {*} value Limit. @returns {number} Limit. */
  limit(value) {
    const parsed = Number(value || this.config.defaultPageSize);
    if (!Number.isSafeInteger(parsed) || parsed < 1) return this.config.defaultPageSize;
    return Math.min(parsed, this.config.maxPageSize);
  }
}

export default ConversationValidation;
