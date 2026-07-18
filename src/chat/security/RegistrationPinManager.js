import SecurityEvents from './SecurityEvents';

/**
 * Mobile Registration PIN manager.
 */
export class RegistrationPinManager {
  /**
   * Creates PIN manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.client = options.client;
    this.eventBus = options.eventBus;
    this.logger = options.logger;
  }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  async create(input) {
    const result = await this.client.createPin(input);
    this.eventBus?.emit?.(SecurityEvents.PIN_CREATED, { accountId: result.accountId });
    this.logger?.info?.('Security PIN created', { accountId: result.accountId });
    return result;
  }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  async verify(input) {
    const result = await this.client.verifyPin(input);
    this.eventBus?.emit?.(SecurityEvents.PIN_VERIFIED, { accountId: result.accountId });
    return result;
  }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  async update(input) {
    const result = await this.client.updatePin(input);
    this.eventBus?.emit?.(SecurityEvents.PIN_UPDATED, { accountId: result.accountId });
    return result;
  }
}

export default RegistrationPinManager;
