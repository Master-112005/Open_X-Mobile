/**
 * Mobile wake manager for silent push to mailbox sync.
 */
export class WakeManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.pushManager = options.pushManager;
    this.recoveryManager = options.recoveryManager;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {object} input Wake input. @returns {Promise<object>} Wake result. */
  async handlePush(input = {}) {
    const payload = this.pushManager.validatePayload(input.payload || input);
    this.eventBus?.emit?.(this.events.WAKE, { notificationId: payload.notificationId, mailboxHint: payload.mailboxHint });
    const recovery = await this.recoveryManager.recover({
      accountId: input.accountId,
      deviceId: input.deviceId,
      afterSequence: input.afterSequence || 0,
      limit: input.limit,
      reason: 'silent-push',
    });
    return { payload, recovery, shouldSleep: true };
  }
}

export default WakeManager;
