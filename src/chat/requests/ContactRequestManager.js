import RequestConfiguration from './RequestConfiguration';
import RequestEvents from './RequestEvents';
import RequestLogger from './RequestLogger';
import RequestService from './RequestService';
import RequestValidation from './RequestValidation';

/**
 * Mobile facade for creating and managing contact requests.
 */
export class ContactRequestManager {
  /**
   * Creates a contact request manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof RequestConfiguration ? options.config : new RequestConfiguration(options.config || {});
    this.eventBus = options.eventBus;
    this.logger = options.logger || new RequestLogger();
    this.validator = options.validator || new RequestValidation({ config: this.config });
    this.service = options.service || new RequestService({ config: this.config, fetchImpl: options.fetchImpl });
  }

  /**
   * Creates a contact request from an opaque token.
   * @param {object} input Request input.
   * @returns {Promise<object>} Created request.
   */
  async createRequest(input = {}) {
    const payload = {
      senderAccountId: this.validator.accountId(input.senderAccountId),
      opaqueContactToken: this.validator.opaqueContactToken(input.opaqueContactToken),
      messagePreview: this.validator.messagePreview(input.messagePreview),
      metadata: this.validator.metadata(input.metadata),
    };
    this.emit(RequestEvents.REQUEST_CREATE_STARTED, { senderAccountId: payload.senderAccountId });
    try {
      const request = await this.service.createRequest(payload);
      this.emit(RequestEvents.REQUEST_CREATED, { requestId: request.requestId });
      return request;
    } catch (error) {
      this.logger.warn('Contact request creation failed', { error: error.message, code: error.code });
      this.emit(RequestEvents.REQUEST_CREATE_FAILED, { error: error.message, code: error.code });
      throw error;
    }
  }

  /**
   * Lists pending incoming requests.
   * @param {string} accountId AccountID.
   * @returns {Promise<object[]>} Requests.
   */
  async listPendingIncoming(accountId) {
    const data = await this.service.listPendingIncoming(this.validator.accountId(accountId));
    return data.requests || [];
  }

  /**
   * Lists outgoing requests.
   * @param {string} accountId AccountID.
   * @returns {Promise<object[]>} Requests.
   */
  async listOutgoing(accountId) {
    const data = await this.service.listOutgoing(this.validator.accountId(accountId));
    return data.requests || [];
  }

  /**
   * Accepts a pending incoming request.
   * @param {object} input Accept input.
   * @returns {Promise<object>} Request and relationship.
   */
  async acceptRequest(input = {}) {
    const result = await this.service.acceptRequest({
      accountId: this.validator.accountId(input.accountId),
      requestId: this.validator.requestId(input.requestId),
    });
    this.emit(RequestEvents.REQUEST_ACCEPTED, { requestId: result.request?.requestId });
    if (result.relationship) this.emit(RequestEvents.TRUST_ESTABLISHED, { relationshipId: result.relationship.relationshipId });
    return result;
  }

  /**
   * Deletes a pending incoming request.
   * @param {object} input Delete input.
   * @returns {Promise<object>} Deleted request.
   */
  async deleteRequest(input = {}) {
    const request = await this.service.deleteRequest({
      accountId: this.validator.accountId(input.accountId),
      requestId: this.validator.requestId(input.requestId),
      reason: this.validator.reason(input.reason),
    });
    this.emit(RequestEvents.REQUEST_DELETED, { requestId: request.requestId });
    return request;
  }

  /**
   * Cancels a pending outgoing request.
   * @param {object} input Cancel input.
   * @returns {Promise<object>} Cancelled request.
   */
  async cancelRequest(input = {}) {
    const request = await this.service.cancelRequest({
      accountId: this.validator.accountId(input.accountId),
      requestId: this.validator.requestId(input.requestId),
      reason: this.validator.reason(input.reason),
    });
    this.emit(RequestEvents.REQUEST_CANCELLED, { requestId: request.requestId });
    return request;
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

export default ContactRequestManager;
