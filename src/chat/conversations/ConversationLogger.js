/**
 * Privacy-safe mobile conversation logger.
 */
export class ConversationLogger {
  /**
   * Creates logger.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
  }

  /** @param {string} event Event. @param {object} metadata Metadata. */
  info(event, metadata = {}) {
    this.logger.info?.(`[OpenXChatConversation] ${event}`, this.sanitize(metadata));
  }

  /** @param {string} event Event. @param {object} metadata Metadata. */
  warn(event, metadata = {}) {
    this.logger.warn?.(`[OpenXChatConversation] ${event}`, this.sanitize(metadata));
  }

  /** @param {object} metadata Metadata. @returns {object} Sanitized metadata. */
  sanitize(metadata = {}) {
    const blocked = new Set(['text', 'plaintext', 'plainText', 'message', 'content', 'ciphertext', 'privateKey', 'messageKey', 'fileKey']);
    return Object.fromEntries(Object.entries(metadata).filter(([key]) => !blocked.has(key)));
  }
}

export default ConversationLogger;
