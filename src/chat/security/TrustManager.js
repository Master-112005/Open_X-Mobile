import SecurityEvents from './SecurityEvents';

/**
 * Mobile device trust manager.
 */
export class TrustManager {
  /**
   * Creates trust manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.client = options.client;
    this.eventBus = options.eventBus;
  }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  async approveDevice(input) {
    const result = await this.client.approveDevice(input);
    this.eventBus?.emit?.(SecurityEvents.DEVICE_APPROVED, { accountId: input.accountId, deviceId: input.deviceId });
    return result;
  }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  async revokeDevice(input) {
    const result = await this.client.revokeDevice(input);
    this.eventBus?.emit?.(SecurityEvents.DEVICE_REVOKED, { accountId: input.accountId, deviceId: input.deviceId });
    return result;
  }

  /** @param {string} accountId AccountID. @returns {Promise<object>} Result. */
  trustedDevices(accountId) {
    return this.client.trustedDevices(accountId);
  }
}

export default TrustManager;
