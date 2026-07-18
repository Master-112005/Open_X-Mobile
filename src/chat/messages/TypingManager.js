/**
 * Mobile ephemeral typing manager.
 */
export class TypingManager {
  /**
   * Creates typing manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.client = options.client;
    this.connectionManager = options.connectionManager;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /**
   * Sends typing-start.
   * @param {object} input Input.
   * @returns {Promise<object|boolean>} Result.
   */
  async start(input = {}) {
    this.eventBus?.emit?.(this.events.TYPING_STARTED, input);
    if (this.connectionManager?.sendMessageEvent?.('typing:start', input)) return true;
    return this.client.typingStart(input);
  }

  /**
   * Sends typing-stop.
   * @param {object} input Input.
   * @returns {Promise<object|boolean>} Result.
   */
  async stop(input = {}) {
    this.eventBus?.emit?.(this.events.TYPING_STOPPED, input);
    if (this.connectionManager?.sendMessageEvent?.('typing:stop', input)) return true;
    return this.client.typingStop(input);
  }
}

export default TypingManager;
