import { MessageConstants } from './MessageConstants';

/**
 * Mobile retry manager.
 */
export class RetryManager {
  /**
   * Creates retry manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.client = options.client;
    this.router = options.router;
    this.storage = options.storage;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /**
   * Retries a local queued message.
   * @param {string} messageId MessageID.
   * @returns {Promise<object>} Result.
   */
  async retryMessage(messageId) {
    const retry = this.storage.state.retryQueue.find((item) => item.messageId === messageId);
    if (!retry) throw new Error('Message is not queued for retry.');
    if (retry.retryCount >= this.config.maxRetries) {
      await this.storage.setStatus(messageId, MessageConstants.MESSAGE_STATUS.FAILED);
      throw new Error('Message retry limit exceeded.');
    }
    retry.retryCount += 1;
    retry.status = MessageConstants.MESSAGE_STATUS.RETRYING;
    retry.updatedAt = new Date().toISOString();
    await this.storage.upsertRetry(retry);
    this.eventBus?.emit?.(this.events.RETRY_STARTED, { messageId, retryCount: retry.retryCount });
    const result = await this.router.route({ ...retry.payload, retryCount: retry.retryCount });
    if (result?.transport !== 'local-queue') await this.storage.removeRetry?.(messageId);
    this.eventBus?.emit?.(this.events.RETRY_COMPLETED, { messageId, result });
    return result;
  }

  /** @param {string} envelopeId EnvelopeID. @param {string} reason Reason. @returns {Promise<object>} Result. */
  retryEnvelope(envelopeId, reason = 'manual_retry') { return this.client.retry({ envelopeId, reason }); }
}

export default RetryManager;
