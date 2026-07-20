import { MessageConstants } from './MessageConstants';

/**
 * Mobile message router with WebSocket primary delivery and HTTP fallback.
 */
export class MessageRouter {
  /**
   * Creates router.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.client = options.client;
    this.connectionManager = options.connectionManager;
    this.storage = options.storage;
  }

  /**
   * Routes encrypted message.
   * @param {object} message Message.
   * @returns {Promise<object>} Route result.
   */
  async route(message) {
    try {
      const result = await this.client.send(message);
      await this.storage.setStatus(message.messageId, MessageConstants.MESSAGE_STATUS.SENT);
      return { transport: 'http', queued: false, serverQueued: Number(result.queuedCount || 0) > 0, result };
    } catch (error) {
      await this.storage.setStatus(message.messageId, MessageConstants.MESSAGE_STATUS.QUEUED);
      await this.storage.upsertRetry({
        messageId: message.messageId,
        payload: message,
        retryCount: message.retryCount || 0,
        status: MessageConstants.MESSAGE_STATUS.QUEUED,
        reason: error.code || 'message.route_failed',
        nextRetryAt: new Date(Date.now() + 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return { transport: 'local-queue', queued: true, error: error.message };
    }
  }
}

export default MessageRouter;
