/**
 * Mobile device consistency manager.
 */
export class DeviceConsistencyManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.client = options.client;
    this.copyManager = options.copyManager;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {object} input Consistency input. @returns {Promise<object>} Consistency result. */
  async validate(input = {}) {
    const result = await this.client.validateConsistency(input);
    await this.copyManager.recordConsistency(result);
    this.eventBus?.emit?.(this.events.CONSISTENCY_UPDATED, { consistent: result.consistent });
    return result;
  }

  /** @param {string} deviceId DeviceID. @returns {Promise<object>} Status. */
  async status(deviceId) {
    const result = await this.client.status(deviceId);
    if (result.queue) await this.copyManager.recordQueue(result.queue);
    return result;
  }
}

export default DeviceConsistencyManager;
