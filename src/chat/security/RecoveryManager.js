import SecurityEvents from './SecurityEvents';

/**
 * Mobile account recovery manager.
 */
export class RecoveryManager {
  /**
   * Creates recovery manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.client = options.client;
    this.eventBus = options.eventBus;
  }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  async start(input) {
    const result = await this.client.startRecovery(input);
    this.eventBus?.emit?.(SecurityEvents.RECOVERY_STARTED, { accountId: result.accountId, recoveryId: result.recoveryId });
    return result;
  }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  async complete(input) {
    const result = await this.client.completeRecovery(input);
    this.eventBus?.emit?.(SecurityEvents.RECOVERY_COMPLETED, { accountId: result.accountId, recoveryId: result.recoveryId });
    return result;
  }
}

export default RecoveryManager;
