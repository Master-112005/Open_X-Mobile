/**
 * Mobile local presence state manager.
 */
export class PresenceManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.events = options.events;
    this.state = { state: 'Offline', updatedAt: null };
  }

  /** @param {object} input Presence input. @returns {object} Presence. */
  setPresence(input = {}) {
    this.state = {
      accountId: input.accountId || this.state.accountId || null,
      deviceId: input.deviceId || this.state.deviceId || null,
      state: input.state || 'Online',
      updatedAt: new Date().toISOString(),
      source: input.source || 'mobile',
    };
    this.eventBus?.emit?.(this.events.PRESENCE_CHANGED, this.state);
    return this.state;
  }

  /** @returns {object} Presence. */
  getPresence() {
    return this.state;
  }
}

export default PresenceManager;
