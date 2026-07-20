/**
 * Mobile Phase 8 message configuration.
 */
export class MessageConfiguration {
  /**
   * Creates message configuration.
   * @param {object} options Overrides.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || 'https://openx-chat-server.onrender.com').replace(/\/+$/, '');
    this.protocolVersion = String(options.protocolVersion || '1');
    this.maxMessageSizeBytes = Number(options.maxMessageSizeBytes || 65536);
    this.compressionThresholdBytes = Number(options.compressionThresholdBytes || 1024);
    this.requestTimeoutMs = Number(options.requestTimeoutMs || 15000);
    this.maxQueueSize = Number(options.maxQueueSize || 1000);
    this.maxStoredMessages = Number(options.maxStoredMessages || 300);
    this.maxRetries = Number(options.maxRetries || 5);
    this.retryBaseDelayMs = Number(options.retryBaseDelayMs || 1000);
    this.retryMaxDelayMs = Number(options.retryMaxDelayMs || 60000);
    this.typingTimeoutMs = Number(options.typingTimeoutMs || 8000);
    this.ackTimeoutMs = Number(options.ackTimeoutMs || 30000);
    this.storageKey = options.storageKey || '@openx-chat/messages';
    this.requireSessionKey = options.requireSessionKey !== false;
    this.allowEphemeralSessionKey = options.allowEphemeralSessionKey === true;
    this.supportedTypes = Object.freeze(options.supportedTypes || ['Text', 'Emoji']);
    this.compressionAlgorithms = Object.freeze(options.compressionAlgorithms || ['none']);
    this.encryptionVersion = String(options.encryptionVersion || 'phase4-aes-256-gcm');
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates message configuration.
   */
  validate() {
    if (this.maxMessageSizeBytes < 1) throw new Error('Message maximum size must be positive.');
    if (this.compressionThresholdBytes < 0) throw new Error('Message compression threshold is invalid.');
    if (this.requestTimeoutMs < 1000) throw new Error('Message request timeout is too small.');
    if (this.maxStoredMessages < 1) throw new Error('Message storage limit must be positive.');
    if (this.maxRetries < 0) throw new Error('Message retry max must be >= 0.');
    if (!this.supportedTypes.every((type) => ['Text', 'Emoji'].includes(type))) throw new Error('Only Text and Emoji are enabled in Phase 8.');
  }
}

export default MessageConfiguration;
