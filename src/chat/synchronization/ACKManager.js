/**
 * Mobile ACK manager for highest contiguous sync acknowledgements.
 */
export class ACKManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.client = options.client;
    this.cursorStore = options.cursorStore;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {object} input ACK input. @returns {Promise<object|null>} ACK result. */
  async acknowledge(input = {}) {
    if (!input.highestContiguousSequence || input.highestContiguousSequence <= input.afterSequence) return null;
    this.eventBus?.emit?.(this.events.ACK_SENT, { deviceId: input.deviceId, sequence: input.highestContiguousSequence });
    const result = await this.client.acknowledge({
      deviceId: input.deviceId,
      highestContiguousSequence: input.highestContiguousSequence,
    });
    await this.cursorStore.recordAck({
      deviceId: input.deviceId,
      highestContiguousSequence: input.highestContiguousSequence,
      duplicate: Boolean(result.acknowledgement?.duplicate),
      createdAt: new Date().toISOString(),
    });
    this.eventBus?.emit?.(this.events.ACK_RECEIVED, { deviceId: input.deviceId, sequence: input.highestContiguousSequence });
    return result;
  }
}

export default ACKManager;
