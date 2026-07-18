/**
 * Calculates Mobile Chat reconnect backoff.
 */
export class ConnectionOptimizer {
  /**
   * Creates a connection optimizer.
   * @param {object} options Optimizer options.
   */
  constructor(options = {}) {
    this.config = options.config || {};
    this.eventBus = options.eventBus;
    this.failures = 0;
    this.successes = 0;
  }

  /**
   * Records connection outcome.
   * @param {boolean} success Whether connection succeeded.
   */
  recordConnectionResult(success) {
    if (success) {
      this.successes += 1;
      this.failures = 0;
    } else {
      this.failures += 1;
    }
  }

  /**
   * Returns next reconnect delay.
   * @returns {number} Delay in ms.
   */
  nextReconnectDelay() {
    const min = Number(this.config.reconnectMinDelayMs || 1000);
    const max = Number(this.config.reconnectMaxDelayMs || 30000);
    const delay = Math.min(max, min * (2 ** Math.max(0, this.failures - 1)));
    this.eventBus?.emit?.('chat.infrastructure.connection_backoff', { failures: this.failures, delay });
    return delay;
  }

  /**
   * Returns connection status.
   * @returns {object} Status.
   */
  getStatus() {
    return { failures: this.failures, successes: this.successes, nextReconnectDelayMs: this.nextReconnectDelay() };
  }
}

export default ConnectionOptimizer;
