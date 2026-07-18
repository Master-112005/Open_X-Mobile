import RequestConfiguration from './RequestConfiguration';
import RequestEvents from './RequestEvents';
import RequestLogger from './RequestLogger';
import RequestService from './RequestService';
import RequestValidation from './RequestValidation';

/**
 * Mobile block manager for Phase 6 contact request controls.
 */
export class BlockManager {
  /**
   * Creates a block manager.
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
   * Blocks the sender of a pending incoming request.
   * @param {object} input Block input.
   * @returns {Promise<object>} Request and block.
   */
  async blockRequest(input = {}) {
    const result = await this.service.blockRequest({
      accountId: this.validator.accountId(input.accountId),
      requestId: this.validator.requestId(input.requestId),
      reason: this.validator.reason(input.reason),
      metadata: this.validator.metadata(input.metadata),
    });
    this.emit(RequestEvents.REQUEST_BLOCKED, { requestId: result.request?.requestId });
    return result;
  }

  /**
   * Lists active blocks for an account.
   * @param {string} accountId AccountID.
   * @returns {Promise<object[]>} Block records.
   */
  async listBlockedAccounts(accountId) {
    const data = await this.service.listBlockedAccounts(this.validator.accountId(accountId));
    return data.blockedAccounts || [];
  }

  /**
   * Removes an active block.
   * @param {object} input Unblock input.
   * @returns {Promise<object>} Removed block.
   */
  async unblockAccount(input = {}) {
    const block = await this.service.unblockAccount({
      ownerAccountId: this.validator.accountId(input.ownerAccountId),
      blockedAccountId: this.validator.accountId(input.blockedAccountId),
    });
    this.emit(RequestEvents.BLOCK_REMOVED, { blockId: block.blockId });
    return block;
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

export default BlockManager;
