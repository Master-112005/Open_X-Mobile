/**
 * Mobile message acknowledgement manager.
 */
export class AcknowledgementManager {
  /**
   * Creates manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.client = options.client;
    this.mailboxManager = options.mailboxManager;
    this.storage = options.storage;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {object} input ACK input. @returns {Promise<object>} Result. */
  acknowledge(input = {}) { return this.client.acknowledge(input); }

  /** @param {object} input Mailbox ACK input. @returns {Promise<object>} Result. */
  acknowledgeMailbox(input = {}) { return this.mailboxManager.acknowledge(input); }

  /**
   * Marks messages read locally and remotely.
   * @param {object} input Read input.
   * @returns {Promise<object>} Result.
   */
  async markRead(input = {}) {
    for (const messageId of input.messageIds || []) await this.storage.markRead(messageId, input.readAt || null);
    const result = await this.client.markRead(input);
    this.eventBus?.emit?.(this.events.MESSAGE_READ, { messageIds: input.messageIds || [] });
    return result;
  }
}

export default AcknowledgementManager;
