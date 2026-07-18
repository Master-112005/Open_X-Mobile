import RequestConfiguration from './RequestConfiguration';
import RequestEvents from './RequestEvents';
import RequestLogger from './RequestLogger';
import RequestService from './RequestService';
import RequestValidation from './RequestValidation';

/**
 * Mobile trust manager for relationships created by accepted requests.
 */
export class TrustManager {
  /**
   * Creates a trust manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof RequestConfiguration ? options.config : new RequestConfiguration(options.config || {});
    this.eventBus = options.eventBus;
    this.logger = options.logger || new RequestLogger();
    this.validator = options.validator || new RequestValidation({ config: this.config });
    this.service = options.service || new RequestService({ config: this.config, fetchImpl: options.fetchImpl });
    this.relationships = new Map();
  }

  /**
   * Accepts a pending request and caches the trusted relationship.
   * @param {object} input Accept input.
   * @returns {Promise<object>} Request and relationship.
   */
  async acceptRequest(input = {}) {
    const result = await this.service.acceptRequest({
      accountId: this.validator.accountId(input.accountId),
      requestId: this.validator.requestId(input.requestId),
    });
    if (result.relationship) {
      this.relationships.set(result.relationship.relationshipId, result.relationship);
      this.emit(RequestEvents.TRUST_ESTABLISHED, { relationshipId: result.relationship.relationshipId });
    }
    return result;
  }

  /**
   * Caches a trusted relationship already returned by the API.
   * @param {object} relationship Trusted relationship.
   * @returns {object|null} Cached relationship.
   */
  cacheRelationship(relationship) {
    if (!relationship?.relationshipId) return null;
    this.relationships.set(relationship.relationshipId, relationship);
    return relationship;
  }

  /**
   * Lists cached relationships.
   * @returns {object[]} Relationships.
   */
  listCachedRelationships() {
    return Array.from(this.relationships.values());
  }

  /**
   * Emits an event.
   * @param {string} eventName Event name.
   * @param {object} payload Payload.
   */
  emit(eventName, payload = {}) {
    this.eventBus?.emit?.(eventName, payload);
  }
}

export default TrustManager;
