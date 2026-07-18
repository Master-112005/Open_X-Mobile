import DiscoveryConfiguration from './DiscoveryConfiguration';
import DiscoveryEvents from './DiscoveryEvents';
import DiscoveryLogger from './DiscoveryLogger';
import DiscoveryService from './DiscoveryService';
import DiscoveryValidation from './DiscoveryValidation';

/**
 * Mobile contact discovery facade.
 */
export class ContactDiscoveryManager {
  /**
   * Creates contact discovery manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof DiscoveryConfiguration ? options.config : new DiscoveryConfiguration(options.config || {});
    this.eventBus = options.eventBus;
    this.logger = options.logger || new DiscoveryLogger();
    this.validator = options.validator || new DiscoveryValidation();
    this.service = options.service || new DiscoveryService({ config: this.config, fetchImpl: options.fetchImpl });
  }

  /**
   * Performs exact phone discovery.
   * @param {object} input Lookup input.
   * @returns {Promise<object>} Opaque token response.
   */
  async lookup(input = {}) {
    const payload = {
      phoneNumber: this.validator.phoneNumber(input.phoneNumber),
      countryCode: this.validator.countryCode(input.countryCode || this.config.defaultCountryCode),
      metadata: this.validator.metadata(input.metadata),
    };
    this.emit(DiscoveryEvents.LOOKUP_STARTED, { lookupType: 'phone' });
    try {
      const result = await this.service.lookup(payload);
      this.emit(DiscoveryEvents.LOOKUP_COMPLETED, { tokenStatus: result.tokenStatus, discoveryStatus: result.discoveryStatus });
      return result;
    } catch (error) {
      this.logger.warn('Contact discovery lookup failed', { error: error.message });
      this.emit(DiscoveryEvents.LOOKUP_FAILED, { error: error.message });
      throw error;
    }
  }

  /**
   * Validates an opaque contact token.
   * @param {string} opaqueContactToken Token.
   * @returns {Promise<object>} Validation response.
   */
  async validateToken(opaqueContactToken) {
    const result = await this.service.validateToken({ opaqueContactToken: this.validator.opaqueToken(opaqueContactToken) });
    this.emit(DiscoveryEvents.TOKEN_VALIDATED, { valid: result.valid, tokenStatus: result.tokenStatus });
    return result;
  }

  /**
   * Gets own discovery settings.
   * @param {string} accountId AccountID.
   * @returns {Promise<object>} Settings.
   */
  getSettings(accountId) {
    return this.service.getSettings(this.validator.accountId(accountId));
  }

  /**
   * Updates own discovery settings.
   * @param {object} input Settings input.
   * @returns {Promise<object>} Settings.
   */
  async updateSettings(input = {}) {
    const payload = {
      ...input,
      accountId: this.validator.accountId(input.accountId),
      metadata: this.validator.metadata(input.metadata),
    };
    const settings = await this.service.updateSettings(payload);
    this.emit(DiscoveryEvents.SETTINGS_UPDATED, { scope: settings.scope });
    return settings;
  }

  /**
   * Emits a discovery event.
   * @param {string} eventName Event name.
   * @param {object} payload Payload.
   */
  emit(eventName, payload = {}) {
    this.eventBus?.emit?.(eventName, payload);
  }
}

export default ContactDiscoveryManager;
