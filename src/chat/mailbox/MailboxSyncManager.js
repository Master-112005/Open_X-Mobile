import MailboxEvents from './MailboxEvents';

/**
 * Mobile sequence-based mailbox synchronization manager.
 */
export class MailboxSyncManager {
  /**
   * Creates sync manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.client = options.client;
    this.sequenceManager = options.sequenceManager;
    this.eventBus = options.eventBus;
  }

  /**
   * Retrieves envelopes after local acknowledged sequence.
   * @param {object} input Sync input.
   * @returns {Promise<object>} Sync result.
   */
  async sync(input = {}) {
    const lastAcknowledgedSequence = input.lastAcknowledgedSequence ?? await this.sequenceManager.getLastAcknowledgedSequence(input.deviceId);
    const result = await this.client.retrieveMailbox(input.deviceId, lastAcknowledgedSequence, input.limit);
    this.eventBus?.emit?.(MailboxEvents.MAILBOX_SYNCED, { deviceId: input.deviceId, sequence: result.sequence, count: result.envelopes?.length || 0 });
    return result;
  }
}

export default MailboxSyncManager;
